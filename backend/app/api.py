import logging
import shutil
import stat
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_session
from app.errors import APIError
from app.media import probe_video
from app.models import Job, Result, Video
from app.queue import celery_app
from app.schemas import JobCreate, JobResponse, ResultResponse, VideoPage, VideoResponse
from app.worker import process_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")
ACTIVE_STATUSES = {"queued", "processing", "cancelling"}


def _video_path(video: Video) -> Path:
    path = (settings.storage_root / video.storage_key).resolve()
    if not path.is_relative_to(settings.storage_root.resolve()):
        raise APIError(500, "INTERNAL_ERROR", "Не удалось получить файл из хранилища")
    return path


def _result_path(result: Result) -> Path:
    path = (settings.storage_root / result.storage_key).resolve()
    if not path.is_relative_to(settings.storage_root.resolve()):
        raise APIError(500, "INTERNAL_ERROR", "Не удалось получить файл из хранилища")
    return path


def _stage_path_for_deletion(path: Path) -> Path | None:
    try:
        path.lstat()
    except FileNotFoundError:
        return None
    trash_dir = settings.storage_root / ".trash"
    trash_dir.mkdir(parents=True, exist_ok=True)
    staged = trash_dir / f"{uuid4().hex}-{path.name}"
    path.replace(staged)
    return staged


def _restore_staged_paths(paths: list[tuple[Path, Path | None]]) -> None:
    for original, staged in reversed(paths):
        if staged is None:
            continue
        try:
            staged.lstat()
            original.parent.mkdir(parents=True, exist_ok=True)
            staged.replace(original)
        except FileNotFoundError:
            continue
        except OSError:
            logger.exception("Failed to restore staged file %s", original)


def _purge_staged_path(path: Path | None) -> None:
    if path is None:
        return
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError:
        return
    if stat.S_ISDIR(mode):
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def _raise_not_found(resource: str) -> None:
    raise APIError(
        404,
        "RESOURCE_NOT_FOUND",
        "Запрашиваемый ресурс не найден",
        {"resource": resource},
    )


def _new_job(video_id: UUID, steps: list[dict], message: str) -> Job:
    return Job(
        video_id=video_id,
        status="queued",
        steps=[
            {
                "type": step["type"],
                "status": "queued",
                "parameters": step["parameters"],
                "progress": 0,
                "started_at": None,
                "finished_at": None,
                "error": None,
            }
            for step in steps
        ],
        progress=0,
        current_step=None,
        message=message,
    )


def _enqueue_job(session: Session, job: Job) -> None:
    try:
        process_job.apply_async(args=[str(job.id)])
    except Exception as exc:
        logger.exception("Failed to enqueue job %s", job.id)
        session.delete(job)
        session.commit()
        raise APIError(503, "SERVICE_UNAVAILABLE", "Очередь задач временно недоступна") from exc


@router.post("/videos", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(file: UploadFile = File(...), session: Session = Depends(get_session)) -> Video:
    original_name = (file.filename or "video").replace("\\", "/").rsplit("/", 1)[-1].strip()
    extension = Path(original_name).suffix.lower()
    if extension not in settings.allowed_extensions:
        raise APIError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Формат файла не поддерживается",
            {"supported_formats": sorted(item.lstrip(".") for item in settings.allowed_extensions)},
        )
    if not original_name or original_name in {".", ".."}:
        raise APIError(422, "VALIDATION_ERROR", "Не удалось определить имя файла")

    upload_dir = settings.storage_root / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    video_id = uuid4()
    relative_path = Path("uploads") / f"{video_id}{extension}"
    destination = settings.storage_root / relative_path
    size_bytes = 0
    stored = False
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise APIError(
                        413,
                        "VIDEO_TOO_LARGE",
                        "Размер видео превышает допустимый лимит",
                        {"max_size_bytes": settings.max_upload_bytes},
                    )
                output.write(chunk)
        if size_bytes == 0:
            raise APIError(422, "VALIDATION_ERROR", "Загруженный файл пуст")
        metadata = probe_video(destination)
        content_type = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".webm": "video/webm",
        }[extension]
        video = Video(
            id=video_id,
            filename=original_name[:255],
            content_type=content_type,
            size_bytes=size_bytes,
            storage_key=relative_path.as_posix(),
            **metadata,
        )
        session.add(video)
        session.commit()
        stored = True
        session.refresh(video)
        return video
    except APIError:
        raise
    except (OSError, SQLAlchemyError) as exc:
        session.rollback()
        logger.exception("Failed to store uploaded video")
        raise APIError(500, "INTERNAL_ERROR", "Не удалось сохранить видео") from exc
    finally:
        if not stored:
            try:
                destination.unlink(missing_ok=True)
            except OSError:
                logger.exception("Failed to clean up temporary upload %s", destination)
        await file.close()


@router.get("/videos", response_model=VideoPage)
def list_videos(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
) -> dict:
    total = session.scalar(select(func.count()).select_from(Video)) or 0
    items = session.scalars(
        select(Video).order_by(Video.created_at.desc(), Video.id).limit(limit).offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/videos/{video_id}", response_model=VideoResponse)
def get_video(video_id: UUID, session: Session = Depends(get_session)) -> Video:
    video = session.get(Video, video_id)
    if video is None:
        _raise_not_found("video")
    return video


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: UUID, session: Session = Depends(get_session)) -> Response:
    video = session.scalar(select(Video).where(Video.id == video_id).with_for_update())
    if video is None:
        _raise_not_found("video")
    active_status = session.scalar(
        select(Job.status).where(Job.video_id == video_id, Job.status.in_(ACTIVE_STATUSES)).limit(1)
    )
    if active_status is not None:
        raise APIError(
            409,
            "INVALID_STATE",
            "Видео используется активной задачей",
            {"status": active_status},
        )
    if session.scalar(select(Job.id).where(Job.video_id == video_id).limit(1)) is not None:
        raise APIError(
            409,
            "INVALID_STATE",
            "Видео используется задачами обработки и не может быть удалено",
            {"resource": "job"},
        )
    path = _video_path(video)
    staged_paths: list[tuple[Path, Path | None]] = []
    try:
        staged_paths.append((path, _stage_path_for_deletion(path)))
        session.delete(video)
        session.commit()
    except (OSError, SQLAlchemyError) as exc:
        session.rollback()
        _restore_staged_paths(staged_paths)
        logger.exception("Failed to delete video %s", video_id)
        raise APIError(500, "INTERNAL_ERROR", "Не удалось удалить видео") from exc
    try:
        _purge_staged_path(staged_paths[0][1])
    except OSError as exc:
        logger.exception("Failed to purge deleted video %s", video_id)
        raise APIError(500, "INTERNAL_ERROR", "Не удалось завершить удаление видео") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_job(payload: JobCreate, session: Session = Depends(get_session)) -> Job:
    video = session.scalar(select(Video).where(Video.id == payload.video_id).with_for_update())
    if video is None:
        _raise_not_found("video")
    if not _video_path(video).is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")
    job = _new_job(payload.video_id, [step.model_dump() for step in payload.steps], "Задача добавлена в очередь")
    session.add(job)
    session.commit()
    session.refresh(job)
    _enqueue_job(session, job)
    return job


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, session: Session = Depends(get_session)) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        _raise_not_found("job")
    return job


@router.post("/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: UUID, session: Session = Depends(get_session)) -> Job:
    job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if job is None:
        _raise_not_found("job")
    if job.status in {"cancelling", "cancelled"}:
        return job
    if job.status in {"completed", "failed"}:
        raise APIError(409, "INVALID_STATE", "Задачу в текущем состоянии нельзя отменить", {"status": job.status})
    if job.status == "queued":
        job.status = "cancelled"
        job.message = "Задача отменена"
        job.finished_at = datetime.now(timezone.utc)
        timestamp = job.finished_at.isoformat().replace("+00:00", "Z")
        job.steps = [
            {
                **step,
                "status": "cancelled",
                "finished_at": timestamp,
            }
            for step in job.steps
        ]
    else:
        job.status = "cancelling"
        job.message = "Запрошена отмена задачи"
    session.commit()
    session.refresh(job)
    if job.status == "cancelled":
        try:
            celery_app.control.revoke(str(job.id), terminate=False)
        except Exception:
            logger.exception("Unable to revoke queued job %s", job.id)
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: UUID, session: Session = Depends(get_session)) -> Response:
    job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if job is None:
        _raise_not_found("job")
    if job.status in ACTIVE_STATUSES:
        raise APIError(
            409,
            "INVALID_STATE",
            "Активную задачу нельзя удалить",
            {"status": job.status},
        )
    result_path = _result_path(job.result) if job.result is not None else None
    work_dir = settings.storage_root / "jobs" / str(job.id)
    staged_paths: list[tuple[Path, Path | None]] = []
    try:
        if result_path is not None:
            staged_paths.append((result_path, _stage_path_for_deletion(result_path)))
        staged_paths.append((work_dir, _stage_path_for_deletion(work_dir)))
        session.delete(job)
        session.commit()
    except (OSError, SQLAlchemyError) as exc:
        session.rollback()
        _restore_staged_paths(staged_paths)
        logger.exception("Failed to delete job %s", job_id)
        raise APIError(500, "INTERNAL_ERROR", "Не удалось удалить задачу") from exc
    try:
        for _, staged in staged_paths:
            _purge_staged_path(staged)
    except OSError as exc:
        logger.exception("Failed to purge files for deleted job %s", job_id)
        raise APIError(500, "INTERNAL_ERROR", "Не удалось завершить удаление задачи") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/jobs/{job_id}/retry", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def retry_job(job_id: UUID, session: Session = Depends(get_session)) -> Job:
    previous = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if previous is None:
        _raise_not_found("job")
    if previous.status != "failed" or not (previous.error or {}).get("retryable", False):
        raise APIError(
            409,
            "INVALID_STATE",
            "Повтор задачи недоступен в текущем состоянии",
            {"status": previous.status},
        )
    video = session.scalar(select(Video).where(Video.id == previous.video_id).with_for_update())
    if video is None:
        _raise_not_found("video")
    if not _video_path(video).is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")
    retry = _new_job(video.id, previous.steps, "Повторная задача добавлена в очередь")
    session.add(retry)
    session.commit()
    session.refresh(retry)
    _enqueue_job(session, retry)
    return retry


def _get_result_job(job_id: UUID, session: Session) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        _raise_not_found("job")
    if job.status != "completed":
        raise APIError(
            409,
            "INVALID_STATE",
            "Результат ещё не готов",
            {"status": job.status},
        )
    if job.result is None:
        _raise_not_found("result")
    return job


@router.get("/jobs/{job_id}/result", response_model=ResultResponse)
def get_job_result(job_id: UUID, session: Session = Depends(get_session)) -> dict:
    job = _get_result_job(job_id, session)
    result = job.result
    if not _result_path(result).is_file():
        raise APIError(410, "RESOURCE_GONE", "Результат больше недоступен")
    return {
        "id": result.id,
        "job_id": result.job_id,
        "filename": result.filename,
        "content_type": result.content_type,
        "size_bytes": result.size_bytes,
        "duration_seconds": result.duration_seconds,
        "width": result.width,
        "height": result.height,
        "fps": result.fps,
        "download_url": f"/api/v1/jobs/{job_id}/result/download",
        "created_at": result.created_at,
    }


@router.get("/jobs/{job_id}/result/download")
def download_job_result(job_id: UUID, session: Session = Depends(get_session)) -> FileResponse:
    job = _get_result_job(job_id, session)
    result = job.result
    path = _result_path(result)
    if not path.is_file():
        raise APIError(410, "RESOURCE_GONE", "Результат больше недоступен")
    try:
        actual_size = path.stat().st_size
        with path.open("rb"):
            pass
    except OSError as exc:
        logger.exception("Failed to read result file for job %s", job_id)
        raise APIError(500, "INTERNAL_ERROR", "Не удалось прочитать файл результата") from exc
    if actual_size != result.size_bytes:
        raise APIError(500, "INTERNAL_ERROR", "Размер файла результата изменился")
    return FileResponse(
        path=path,
        media_type=result.content_type,
        filename=result.filename,
        headers={"Content-Length": str(actual_size)},
    )
