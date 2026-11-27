import logging
import math
import shutil
import stat
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app.config import (
    COLOR_PRESETS,
    EXPORT_PROFILES,
    EXPORT_TOKEN_COST,
    PLAN_PRICES,
    PLAN_TOKENS,
    STEP_ORDER,
    settings,
)

import httpx
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import (
    clear_auth_cookie,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from app.billing import (
    charge_tokens,
    refund_export,
    refund_job,
    refund_tokens,
)
from app.database import get_session
from app.errors import APIError
from app.media import probe_video
from app.models import ExportJob, Job, Payment, Result, User, Video
from app.pricing import PricingError, estimate_job_cost, fps_coefficient, resolution_coefficient
from app.queue import celery_app
from app.schemas import (
    ExportJobCreate,
    ColorPreviewRequest,
    ExportJobResponse,
    JobCreate,
    JobEstimateRequest,
    JobEstimateResponse,
    JobResponse,
    LoginIn,
    PaymentOut,
    PlanPurchaseIn,
    ProjectPage,
    RegisterIn,
    ResultResponse,
    UserOut,
    VideoPage,
    VideoResponse,
)
from app.storage import user_directory, user_relative_path
from app.worker import process_export_job, process_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")
ACTIVE_STATUSES = {"queued", "processing", "cancelling"}
SUPPORTED_FPS_MULTIPLIERS = (1, 2, 4, 8, 16)


def _raise_pricing_error(exc: PricingError) -> None:
    raise APIError(422, exc.code, exc.message, exc.details) from exc


def _validate_video_metadata(metadata: dict) -> None:
    """Reject sources whose resolution or FPS is outside product limits."""
    try:
        resolution_coefficient(metadata.get("width"), metadata.get("height"))
        fps_coefficient(metadata.get("fps"))
    except PricingError as exc:
        _raise_pricing_error(exc)


def _estimate_for_video(video: Video, steps: list[dict]) -> dict:
    try:
        return estimate_job_cost(
            {
                "duration_seconds": video.duration_seconds,
                "width": video.width,
                "height": video.height,
                "fps": video.fps,
            },
            steps,
        )
    except PricingError as exc:
        _raise_pricing_error(exc)


def _validate_interpolate_steps(video: Video, steps: list) -> None:
    """Reject target FPS values the AI interpolator cannot produce."""
    source_fps = video.fps
    if source_fps is None or not math.isfinite(source_fps) or source_fps <= 0:
        return

    for step in steps:
        if step.type != "interpolate":
            continue
        target_fps = step.parameters["target_fps"]
        ratio = target_fps / source_fps
        factor = round(ratio)
        if factor not in SUPPORTED_FPS_MULTIPLIERS or abs(ratio - factor) > 0.01:
            choices = [
                round(source_fps * multiplier, 3)
                for multiplier in SUPPORTED_FPS_MULTIPLIERS
                if multiplier > 1
            ]
            raise APIError(
                422,
                "VALIDATION_ERROR",
                "Недопустимая целевая частота кадров для исходного видео",
                {
                    "source_fps": round(source_fps, 3),
                    "target_fps": target_fps,
                    "allowed_target_fps": choices,
                },
            )


def _owned_storage_path(storage_key: str, user_id: UUID) -> Path:
    root = settings.storage_root.resolve()
    prefix = root / "users" / str(user_id)
    path = (root / storage_key).resolve()
    if not path.is_relative_to(prefix):
        raise APIError(500, "INTERNAL_ERROR", "Не удалось получить файл из хранилища")
    return path


def _video_path(video: Video) -> Path:
    return _owned_storage_path(video.storage_key, video.user_id)


def _result_path(result: Result) -> Path:
    return _owned_storage_path(result.storage_key, result.user_id)


def _export_path(job: ExportJob) -> Path:
    if not job.output_path:
        raise APIError(410, "RESOURCE_GONE", "Файл экспорта больше недоступен")
    return _owned_storage_path(job.output_path, job.user_id)


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


def _get_owned_video(session: Session, video_id: UUID, user: User, *, lock: bool = False) -> Video:
    query = select(Video).where(Video.id == video_id, Video.user_id == user.id)
    if lock:
        query = query.with_for_update()
    video = session.scalar(query)
    if video is None:
        _raise_not_found("video")
    return video


def _get_owned_job(session: Session, job_id: UUID, user: User, *, lock: bool = False) -> Job:
    query = select(Job).where(Job.id == job_id, Job.user_id == user.id)
    if lock:
        query = query.with_for_update()
    job = session.scalar(query)
    if job is None:
        _raise_not_found("job")
    return job


def _get_owned_export(session: Session, export_id: UUID, user: User, *, lock: bool = False) -> ExportJob:
    query = select(ExportJob).where(ExportJob.id == export_id, ExportJob.user_id == user.id)
    if lock:
        query = query.with_for_update()
    export = session.scalar(query)
    if export is None:
        _raise_not_found("export_job")
    return export


def _new_job(
    video_id: UUID,
    user_id: UUID,
    steps: list[dict],
    message: str,
    *,
    credits_cost: int = 0,
    credits_breakdown: dict | None = None,
) -> Job:
    return Job(
        video_id=video_id,
        user_id=user_id,
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
            for step in sorted(steps, key=lambda item: STEP_ORDER.get(item["type"], len(STEP_ORDER)))
        ],
        progress=0,
        current_step=None,
        message=message,
        credits_cost=credits_cost,
        credits_breakdown=credits_breakdown,
    )


def _enqueue_job(session: Session, job: Job) -> None:
    try:
        process_job.apply_async(args=[str(job.id)])
    except Exception as exc:
        logger.exception("Failed to enqueue job %s", job.id)
        refund_job(session, job)
        session.delete(job)
        session.commit()
        raise APIError(503, "SERVICE_UNAVAILABLE", "Очередь задач временно недоступна") from exc


def _enqueue_export_job(session: Session, job: ExportJob) -> None:
    try:
        process_export_job.apply_async(args=[str(job.id)])
    except Exception as exc:
        logger.exception("Failed to enqueue export %s", job.id)
        refund_export(session, job)
        session.delete(job)
        session.commit()
        raise APIError(503, "SERVICE_UNAVAILABLE", "Очередь задач временно недоступна") from exc


@router.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, response: Response, session: Session = Depends(get_session)) -> User:
    username = payload.username.strip().lower()
    if session.scalar(select(User.id).where(User.username == username)) is not None:
        raise APIError(409, "USERNAME_TAKEN", "Этот логин уже занят", {"username": username})
    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or "").strip() or None,
        plan="free",
        token_balance=PLAN_TOKENS["free"],
    )
    session.add(user)
    try:
        session.flush()
        session.add(
            Payment(
                user_id=user.id,
                plan="free",
                amount_rub=PLAN_PRICES["free"],
                tokens=PLAN_TOKENS["free"],
                status="free",
            )
        )
        session.commit()
        session.refresh(user)
    except SQLAlchemyError as exc:
        session.rollback()
        raise APIError(409, "USERNAME_TAKEN", "Этот логин уже занят", {"username": username}) from exc
    set_auth_cookie(response, user.id)
    return user


@router.post("/auth/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, session: Session = Depends(get_session)) -> User:
    username = payload.username.strip().lower()
    user = session.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise APIError(401, "UNAUTHORIZED", "Неверный логин или пароль")
    set_auth_cookie(response, user.id)
    return user


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    clear_auth_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/billing/purchase", response_model=UserOut)
def purchase_plan(
    payload: PlanPurchaseIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    plan = payload.plan.strip().lower()
    if plan == "free":
        raise APIError(
            422,
            "PLAN_UNAVAILABLE",
            "Тариф Free выдаётся только при регистрации и недоступен для покупки",
            {"plan": plan},
        )
    if plan not in PLAN_TOKENS:
        raise APIError(
            422,
            "VALIDATION_ERROR",
            "Неизвестный тариф",
            {"plan": plan, "available_plans": sorted(PLAN_TOKENS)},
        )
    user.plan = plan
    user.token_balance += PLAN_TOKENS[plan]
    session.add(
        Payment(
            user_id=user.id,
            plan=plan,
            amount_rub=PLAN_PRICES[plan],
            tokens=PLAN_TOKENS[plan],
            status="paid",
        )
    )
    try:
        session.commit()
        session.refresh(user)
    except SQLAlchemyError as exc:
        session.rollback()
        raise APIError(500, "INTERNAL_ERROR", "Не удалось начислить токены") from exc
    logger.info("User %s purchased plan %s (+%d tokens)", user.id, plan, PLAN_TOKENS[plan])
    return user


@router.get("/billing/payments", response_model=list[PaymentOut])
def list_payments(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Payment]:
    """Return the current user's real payment history, newest first."""
    return list(
        session.scalars(
            select(Payment)
            .where(Payment.user_id == user.id)
            .order_by(Payment.created_at.desc(), Payment.id.desc())
        ).all()
    )


@router.post("/videos", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Video:
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

    upload_dir = user_directory(settings.storage_root, user.id, "uploads")
    video_id = uuid4()
    relative_path = user_relative_path(user.id, "uploads", f"{video_id}{extension}")
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
        _validate_video_metadata(metadata)
        content_type = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".webm": "video/webm",
        }[extension]
        video = Video(
            id=video_id,
            user_id=user.id,
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
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    total = session.scalar(
        select(func.count()).select_from(Video).where(Video.user_id == user.id)
    ) or 0
    items = session.scalars(
        select(Video)
        .where(Video.user_id == user.id)
        .order_by(Video.created_at.desc(), Video.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/videos/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Video:
    return _get_owned_video(session, video_id, user)


@router.post("/videos/{video_id}/color-preview")
def color_preview(
    video_id: UUID,
    payload: ColorPreviewRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Proxy a single-frame before/after preview to the AI service."""
    video = _get_owned_video(session, video_id, user)
    source = _video_path(video)
    if not source.is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")

    mode = payload.mode
    preset = payload.preset if mode == "preset" else None
    if mode == "preset" and preset not in (None, "") and preset not in COLOR_PRESETS:
        raise APIError(
            422, "VALIDATION_ERROR", "Недопустимый пресет коррекции цвета",
            {"preset": preset, "allowed_presets": list(COLOR_PRESETS)},
        )

    try:
        response = httpx.post(
            f"{settings.ai_service_url}/internal/v1/color_preview",
            json={
                "input_uri": str(source),
                "params": {"mode": mode, "preset": preset, "sharpness": payload.sharpness},
            },
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise APIError(503, "SERVICE_UNAVAILABLE", "Сервис обработки видео временно недоступен") from exc

    if response.is_error:
        raise APIError(502, "AI_PROCESSING_ERROR", "Не удалось построить предпросмотр коррекции")
    try:
        data = response.json()
    except ValueError as exc:
        raise APIError(502, "AI_PROCESSING_ERROR", "AI Service вернул некорректный предпросмотр") from exc
    if (
        not isinstance(data, dict)
        or data.get("status") != "completed"
        or not isinstance(data.get("before_base64"), str)
        or not isinstance(data.get("after_base64"), str)
    ):
        raise APIError(502, "AI_PROCESSING_ERROR", "AI Service вернул некорректный предпросмотр")
    return {"before": data["before_base64"], "after": data["after_base64"]}


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(
    video_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    video = _get_owned_video(session, video_id, user, lock=True)
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


@router.post("/jobs/estimate", response_model=JobEstimateResponse)
def estimate_job(
    payload: JobEstimateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    video = _get_owned_video(session, payload.video_id, user)
    _validate_interpolate_steps(video, payload.steps)
    breakdown = _estimate_for_video(video, [step.model_dump() for step in payload.steps])
    export_count = len(set(payload.export_profile_ids) & set(EXPORT_PROFILES))
    export_credits = export_count * EXPORT_TOKEN_COST
    total_credits = breakdown["credits"] + export_credits
    balance = session.scalar(select(User.token_balance).where(User.id == user.id)) or 0
    return {
        "breakdown": breakdown,
        "export_cost_each": EXPORT_TOKEN_COST,
        "export_credits": export_credits,
        "total_credits": total_credits,
        "token_balance": balance,
        "affordable": balance >= total_credits,
    }


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_job(
    payload: JobCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Job:
    video = _get_owned_video(session, payload.video_id, user, lock=True)
    if not _video_path(video).is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")
    _validate_interpolate_steps(video, payload.steps)
    steps = [step.model_dump() for step in payload.steps]
    breakdown = _estimate_for_video(video, steps)
    credits = breakdown["credits"]
    charge_tokens(session, user.id, credits)
    job = _new_job(
        payload.video_id,
        user.id,
        steps,
        "Задача добавлена в очередь",
        credits_cost=credits,
        credits_breakdown=breakdown,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    _enqueue_job(session, job)
    return job


@router.get("/jobs", response_model=ProjectPage)
def list_jobs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    total = session.scalar(
        select(func.count()).select_from(Job).where(Job.user_id == user.id)
    ) or 0
    jobs = session.scalars(
        select(Job)
        .where(Job.user_id == user.id)
        .order_by(Job.created_at.desc(), Job.id)
        .limit(limit)
        .offset(offset)
    ).all()
    if not jobs:
        return {"items": [], "total": total, "limit": limit, "offset": offset}

    job_ids = [job.id for job in jobs]
    video_ids = {job.video_id for job in jobs}
    videos = {
        video.id: video
        for video in session.scalars(
            select(Video).where(Video.id.in_(video_ids), Video.user_id == user.id)
        ).all()
    }
    results = {
        result.job_id: result
        for result in session.scalars(
            select(Result).where(Result.job_id.in_(job_ids), Result.user_id == user.id)
        ).all()
    }
    exports_by_job: dict = defaultdict(list)
    exports = session.scalars(
        select(ExportJob)
        .where(ExportJob.job_id.in_(job_ids), ExportJob.user_id == user.id)
        .order_by(ExportJob.created_at.desc(), ExportJob.id)
    ).all()
    for export in exports:
        exports_by_job[export.job_id].append(export)

    items = []
    for job in jobs:
        video = videos.get(job.video_id)
        result = results.get(job.id)
        items.append({
            "id": job.id,
            "video_id": job.video_id,
            "video_filename": video.filename if video else "Удалённое видео",
            "status": job.status,
            "steps": job.steps,
            "progress": job.progress,
            "current_step": job.current_step,
            "message": job.message,
            "result_id": job.result_id,
            "error": job.error,
            "credits_cost": job.credits_cost,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "exports": exports_by_job[job.id],
            "download_url": f"/api/v1/jobs/{job.id}/result/download" if result else None,
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Job:
    return _get_owned_job(session, job_id, user)


@router.post("/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Job:
    job = _get_owned_job(session, job_id, user, lock=True)
    if job.status in {"cancelling", "cancelled"}:
        return job
    if job.status in {"completed", "failed"}:
        raise APIError(409, "INVALID_STATE", "Задачу в текущем состоянии нельзя отменить", {"status": job.status})
    if job.status == "queued":
        refund_job(session, job)
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

    exports = session.scalars(
        select(ExportJob).where(
            ExportJob.job_id == job_id,
            ExportJob.user_id == user.id,
            ExportJob.status.in_({"queued", "analyzing", "processing", "cancelling"}),
        )
    ).all()
    for export in exports:
        was_queued = export.status == "queued"
        export.status = "cancelled"
        export.user_message = "Задача отменена"
        export.finished_at = datetime.now(timezone.utc)
        if was_queued:
            refund_export(session, export)

    session.commit()
    session.refresh(job)
    revoked_ids = [str(job.id)] if job.status == "cancelled" else []
    revoked_ids.extend(str(export.id) for export in exports)
    for task_id in revoked_ids:
        try:
            celery_app.control.revoke(task_id, terminate=False)
        except Exception:
            logger.exception("Unable to revoke cancelled task %s", task_id)
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    job = _get_owned_job(session, job_id, user, lock=True)
    if job.status in ACTIVE_STATUSES:
        raise APIError(
            409,
            "INVALID_STATE",
            "Активную задачу нельзя удалить",
            {"status": job.status},
        )
    result_path = _result_path(job.result) if job.result is not None else None
    work_dir = settings.storage_root / user_relative_path(job.user_id, "jobs", str(job.id))
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
def retry_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Job:
    previous = _get_owned_job(session, job_id, user, lock=True)
    if previous.status != "failed" or not (previous.error or {}).get("retryable", False):
        raise APIError(
            409,
            "INVALID_STATE",
            "Повтор задачи недоступен в текущем состоянии",
            {"status": previous.status},
        )
    video = _get_owned_video(session, previous.video_id, user, lock=True)
    if not _video_path(video).is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")
    credits = previous.credits_cost
    breakdown = previous.credits_breakdown
    if not credits:
        breakdown = _estimate_for_video(video, previous.steps)
        credits = breakdown["credits"]
    charge_tokens(session, user.id, credits)
    retry = _new_job(
        video.id,
        user.id,
        previous.steps,
        "Повторная задача добавлена в очередь",
        credits_cost=credits,
        credits_breakdown=breakdown,
    )
    session.add(retry)
    session.commit()
    session.refresh(retry)
    _enqueue_job(session, retry)
    return retry


def _get_result_job(job_id: UUID, user: User, session: Session) -> Job:
    job = _get_owned_job(session, job_id, user)
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
def get_job_result(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    job = _get_result_job(job_id, user, session)
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
def download_job_result(
    job_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    job = _get_result_job(job_id, user, session)
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

@router.post("/videos/{video_id}/exports", response_model=ExportJobResponse, status_code=202)
def create_export(
    video_id: UUID,
    payload: ExportJobCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExportJob:
    video = _get_owned_video(session, video_id, user)
    if not _video_path(video).is_file():
        raise APIError(409, "INVALID_STATE", "Исходный файл больше недоступен")

    source_job = None
    if payload.job_id is not None:
        source_job = _get_owned_job(session, payload.job_id, user)
        if source_job.video_id != video_id:
            raise APIError(422, "VALIDATION_ERROR", "Задача обработки не найдена для этого видео")

    profile = EXPORT_PROFILES.get(payload.profile_id)
    if not profile:
        raise APIError(404, "RESOURCE_NOT_FOUND", "Профиль экспорта не найден")

    already_cancelled = source_job is not None and source_job.status in {"failed", "cancelled"}

    if payload.adaptation_mode not in profile["allowed_modes"]:
        raise APIError(
            422,
            "VALIDATION_ERROR",
            f"Режим {payload.adaptation_mode} не поддерживается для этого профиля",
        )

    if not already_cancelled:
        charge_tokens(session, user.id, EXPORT_TOKEN_COST)
    job = ExportJob(
        video_id=video_id,
        user_id=user.id,
        job_id=payload.job_id,
        profile_id=payload.profile_id,
        config_snapshot=profile,
        adaptation_mode=payload.adaptation_mode,
        status="queued",
        credits_cost=0 if already_cancelled else EXPORT_TOKEN_COST,
    )

    # Exports linked to a processing job must use its result, not the source
    # video. Wait until that job finishes; the worker enqueues them afterwards.
    enqueue_now = payload.job_id is None or source_job.status == "completed"
    if source_job is not None and source_job.status in {"failed", "cancelled"}:
        job.status = "cancelled"
        job.user_message = "Обработка видео не завершилась"
        job.finished_at = datetime.now(timezone.utc)
        enqueue_now = False

    session.add(job)
    session.commit()
    session.refresh(job)
    if enqueue_now:
        _enqueue_export_job(session, job)
    return job


@router.get("/exports/{export_id}", response_model=ExportJobResponse)
def get_export(
    export_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExportJob:
    return _get_owned_export(session, export_id, user)


@router.get("/exports/{export_id}/download")
def download_export(
    export_id: UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    job = _get_owned_export(session, export_id, user)
    if job.status != "ready":
        raise APIError(409, "INVALID_STATE", "Экспорт ещё не готов", {"status": job.status})

    path = _export_path(job)
    if not path.is_file():
        raise APIError(410, "RESOURCE_GONE", "Файл экспорта больше недоступен")
    return FileResponse(path=path, media_type="video/mp4", filename=path.name)