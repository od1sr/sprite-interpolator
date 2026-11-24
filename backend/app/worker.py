import json
import logging
import math
import shutil
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4
from app.exporter import run_ffmpeg_export
import httpx
from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import ExportJob, Job, Result, Video
from app.queue import celery_app

logger = logging.getLogger(__name__)


class JobCancelled(Exception):
    pass


class PipelineFailure(Exception):
    def __init__(self, code: str, message: str, retryable: bool, stage: str | None):
        self.code = code
        self.message = message
        self.retryable = retryable
        self.stage = stage


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cleanup_work_dir(path: Path) -> None:
    try:
        shutil.rmtree(path)
    except FileNotFoundError:
        return
    except OSError:
        logger.exception("Failed to clean up worker directory %s", path)


def _cleanup_result_file(path: Path | None) -> None:
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Failed to clean up partial result %s", path)


def _load_job(job_id: UUID) -> tuple[Job, Video] | None:
    with SessionLocal() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        if job is None:
            return None
        session.refresh(job)
        video = session.scalar(select(Video).where(Video.id == job.video_id))
        if video is None:
            return None
        return job, video


def _mark_cancelled(job: Job) -> None:
    timestamp = _now().isoformat().replace("+00:00", "Z")
    job.status = "cancelled"
    job.message = "Задача отменена"
    job.finished_at = _now()
    steps = [dict(step) for step in job.steps]
    for step in steps:
        if step["status"] != "completed":
            step["status"] = "cancelled"
            step["finished_at"] = timestamp
            step["error"] = None
    job.steps = steps


def _finish_cancelled(job_id: UUID) -> None:
    with SessionLocal.begin() as session:
        job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if job is not None:
            _mark_cancelled(job)


def _raise_if_cancelled(job_id: UUID) -> None:
    with SessionLocal() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        if job is None or job.status in {"cancelling", "cancelled"}:
            raise JobCancelled


def _update_step(job_id: UUID, index: int, *, status: str, progress: float, error: dict[str, Any] | None = None) -> None:
    with SessionLocal.begin() as session:
        job = session.scalar(select(Job).where(Job.id == job_id))
        if job is None:
            raise JobCancelled
        steps = [dict(step) for step in job.steps]
        steps[index]["status"] = status
        steps[index]["progress"] = progress
        if status == "processing" and not steps[index].get("started_at"):
            steps[index]["started_at"] = _now().isoformat().replace("+00:00", "Z")
        if status in {"completed", "failed", "cancelled"}:
            steps[index]["finished_at"] = _now().isoformat().replace("+00:00", "Z")
        if error is not None:
            steps[index]["error"] = error
        job.steps = steps
        job.current_step = index
        job.progress = round(sum(float(step.get("progress", 0)) for step in steps) / len(steps), 2)


def _read_step_progress(output_path: Path) -> float | None:
    """Read the progress file written by the AI service into shared storage."""
    try:
        payload = json.loads(Path(f"{output_path}.progress").read_text(encoding="utf-8"))
        value = float(payload["percent"])
    except (OSError, ValueError, TypeError, KeyError):
        return None
    if not math.isfinite(value):
        return None
    return min(99.0, max(0.0, value))


def _call_ai(step_type: str, input_path: Path, output_path: Path, parameters: dict[str, Any]) -> dict[str, Any]:
    try:
        response = httpx.post(
            f"{settings.ai_service_url}/internal/v1/{step_type}",
            json={"input_uri": str(input_path), "output_uri": str(output_path), "params": parameters},
            timeout=settings.ai_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise PipelineFailure(
            "AI_SERVICE_UNAVAILABLE", "Сервис обработки видео временно недоступен", True, step_type
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.is_error:
        status = response.status_code
        code = "AI_SERVICE_UNAVAILABLE" if status >= 500 else "AI_PROCESSING_ERROR"
        retryable = status >= 500
        error_payload = payload.get("error") if isinstance(payload, dict) else None
        message = (
            error_payload.get("message")
            if isinstance(error_payload, dict) and isinstance(error_payload.get("message"), str)
            else "Не удалось обработать видео"
        )[:500]
        raise PipelineFailure(code, message, retryable, step_type)
    if (
        not isinstance(payload, dict)
        or payload.get("status") != "completed"
        or payload.get("output_uri") != str(output_path)
    ):
        raise PipelineFailure("AI_PROCESSING_ERROR", "AI Service вернул некорректный результат", False, step_type)
    required_metadata = ("duration_seconds", "width", "height", "fps")
    if any(
        isinstance(payload.get(key), bool)
        or not isinstance(payload.get(key), (int, float))
        or not math.isfinite(payload[key])
        or payload[key] <= 0
        for key in required_metadata
    ):
        raise PipelineFailure("AI_PROCESSING_ERROR", "AI Service вернул некорректные метаданные", False, step_type)
    if any(
        isinstance(payload[key], bool) or not isinstance(payload[key], int)
        for key in ("width", "height")
    ):
        raise PipelineFailure("AI_PROCESSING_ERROR", "AI Service вернул некорректные размеры видео", False, step_type)
    if (
        isinstance(payload.get("size_bytes"), bool)
        or not isinstance(payload.get("size_bytes"), int)
        or payload["size_bytes"] <= 0
    ):
        raise PipelineFailure("AI_PROCESSING_ERROR", "AI Service вернул некорректный размер файла", False, step_type)
    if not output_path.is_file():
        raise PipelineFailure("STORAGE_ERROR", "AI Service не создал файл результата", True, step_type)
    if payload.get("size_bytes") != output_path.stat().st_size:
        raise PipelineFailure("AI_PROCESSING_ERROR", "Размер файла не совпадает с ответом AI Service", False, step_type)
    return payload


@celery_app.task(name="app.worker.process_job", bind=True)
def process_job(_: Any, job_id: str) -> None:
    parsed_id = UUID(job_id)
    loaded = _load_job(parsed_id)
    if loaded is None:
        return
    job, video = loaded
    if job.status != "queued":
        return

    source = settings.storage_root / video.storage_key
    work_dir = settings.storage_root / "jobs" / str(job.id)
    result_path: Path | None = None
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        if not source.is_file():
            raise PipelineFailure("STORAGE_ERROR", "Исходный файл больше недоступен", False, None)
        with SessionLocal.begin() as session:
            current = session.scalar(select(Job).where(Job.id == parsed_id).with_for_update())
            if current is None or current.status != "queued":
                raise JobCancelled
            current.status = "processing"
            current.started_at = _now()
            current.message = "Обработка видео"

        current_input = source
        final_metadata: dict[str, Any] | None = None
        for index, step in enumerate(job.steps):
            _raise_if_cancelled(parsed_id)
            _update_step(parsed_id, index, status="processing", progress=0)
            output_path = work_dir / f"step-{index:02d}-{step['type']}.mp4"
            try:
                # The AI call is synchronous; run it in a thread so we can keep
                # publishing its frame-level progress to the database while it works.
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(
                        _call_ai, step["type"], current_input, output_path, step["parameters"]
                    )
                    while True:
                        percent = _read_step_progress(output_path)
                        if percent is not None:
                            _raise_if_cancelled(parsed_id)
                            _update_step(parsed_id, index, status="processing", progress=percent)
                        try:
                            future.result(timeout=1.0)
                            break
                        except FutureTimeout:
                            continue
                    final_metadata = future.result()
            except PipelineFailure as exc:
                error = {
                    "code": exc.code,
                    "message": exc.message,
                    "stage": exc.stage,
                    "retryable": exc.retryable,
                    "details": None,
                }
                _update_step(parsed_id, index, status="failed", progress=0, error=error)
                raise
            _raise_if_cancelled(parsed_id)
            _update_step(parsed_id, index, status="completed", progress=100)
            current_input = output_path

        if final_metadata is None:
            raise PipelineFailure("INVALID_PARAMETERS", "Задача не содержит этапов обработки", False, None)
        result_id = uuid4()
        result_filename = f"{Path(video.filename).stem}_processed.mp4"
        result_relative = Path("results") / str(job.id) / result_filename
        _raise_if_cancelled(parsed_id)
        result_path = settings.storage_root / result_relative
        result_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(current_input), str(result_path))
        result_size = result_path.stat().st_size
        with SessionLocal.begin() as session:
            current = session.scalar(select(Job).where(Job.id == parsed_id).with_for_update())
            if current is None:
                raise JobCancelled
            if current.status in {"cancelling", "cancelled"}:
                raise JobCancelled
            result = Result(
                id=result_id,
                job_id=parsed_id,
                filename=result_filename,
                content_type="video/mp4",
                size_bytes=result_size,
                duration_seconds=final_metadata.get("duration_seconds"),
                width=final_metadata.get("width"),
                height=final_metadata.get("height"),
                fps=final_metadata.get("fps"),
                storage_key=result_relative.as_posix(),
            )
            session.add(result)
            current.result_id = result_id
            current.status = "completed"
            current.progress = 100
            current.message = "Обработка завершена"
            current.finished_at = _now()
        _cleanup_work_dir(work_dir)
    except JobCancelled:
        _cleanup_work_dir(work_dir)
        _cleanup_result_file(result_path)
        _finish_cancelled(parsed_id)
    except PipelineFailure as exc:
        logger.warning("Job %s failed during %s: %s", parsed_id, exc.stage, exc.code)
        _cleanup_work_dir(work_dir)
        _cleanup_result_file(result_path)
        error = {
            "code": exc.code,
            "message": exc.message,
            "stage": exc.stage,
            "retryable": exc.retryable,
            "details": None,
        }
        with SessionLocal.begin() as session:
            current = session.scalar(select(Job).where(Job.id == parsed_id).with_for_update())
            if current is not None and current.status in {"cancelling", "cancelled"}:
                _mark_cancelled(current)
            elif current is not None:
                current.status = "failed"
                current.error = error
                current.message = exc.message
                current.finished_at = _now()
    except Exception:
        logger.exception("Unexpected processing error for job %s", parsed_id)
        _cleanup_work_dir(work_dir)
        _cleanup_result_file(result_path)
        with SessionLocal.begin() as session:
            current = session.scalar(select(Job).where(Job.id == parsed_id).with_for_update())
            if current is not None:
                error = {
                    "code": "INTERNAL_ERROR",
                    "message": "Не удалось обработать видео",
                    "stage": None,
                    "retryable": True,
                    "details": None,
                }
                current.status = "failed"
                current.error = error
                current.message = error["message"]
                current.finished_at = _now()
                if current.current_step is not None:
                    steps = [dict(step) for step in current.steps]
                    steps[current.current_step]["status"] = "failed"
                    steps[current.current_step]["finished_at"] = _now().isoformat().replace("+00:00", "Z")
                    steps[current.current_step]["error"] = error
                    current.steps = steps


@celery_app.task(name="app.worker.process_export_job", bind=True)
def process_export_job(_: Any, export_job_id: str) -> None:
    parsed_id = UUID(export_job_id)

    with SessionLocal() as session:
        job = session.get(ExportJob, parsed_id)
        if not job or job.status != "queued":
            return
        video = session.get(Video, job.video_id)
        if not video:
            job.status = "failed"
            job.user_message = "Исходное видео не найдено"
            session.commit()
            return

        job.status = "analyzing"
        job.started_at = _now()
        session.commit()

        input_path = settings.storage_root / video.storage_key
        output_dir = settings.storage_root / "exports" / str(job.id)
        output_path = output_dir / "result.mp4"

        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            job.status = "processing"
            session.commit()
            run_ffmpeg_export(input_path, output_path, job.config_snapshot, job.adaptation_mode)
            if not output_path.is_file() or output_path.stat().st_size == 0:
                raise RuntimeError("FFmpeg не создал файл результата")

            job.status = "ready"
            job.progress = 100
            job.output_path = f"exports/{job.id}/result.mp4"
            job.finished_at = _now()
            session.commit()

        except Exception:
            logger.exception("Ошибка экспорта %s", job.id)
            job.status = "failed"
            job.error_code = "FFMPEG_ERROR"
            job.user_message = "Не удалось обработать видео"
            job.finished_at = _now()
            session.commit()
