import math
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.config import COLOR_PRESETS, STEP_ORDER


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("*", when_used="json")
    def serialize_utc_datetime(self, value: Any) -> Any:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        return value


class VideoResponse(APIModel):
    id: UUID
    filename: str
    content_type: str
    size_bytes: int
    duration_seconds: float | None
    width: int | None
    height: int | None
    fps: float | None
    codec: str | None
    created_at: datetime


class VideoPage(APIModel):
    items: list[VideoResponse]
    total: int
    limit: int
    offset: int


class StepInput(BaseModel):
    type: Literal["upscale", "interpolate", "color_correct"]
    parameters: dict[str, Any]

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, parameters: dict[str, Any], info: Any) -> dict[str, Any]:
        step_type = info.data.get("type")
        if step_type == "upscale":
            if set(parameters) - {"scale", "tile_size"}:
                raise ValueError("Недопустимые параметры upscale")
            scale = parameters.get("scale")
            if isinstance(scale, bool) or not isinstance(scale, int) or scale not in (2, 4):
                raise ValueError("scale должен быть равен 2 или 4")
            tile_size = parameters.get("tile_size")
            if tile_size is not None and (
                isinstance(tile_size, bool) or not isinstance(tile_size, int) or tile_size <= 0
            ):
                raise ValueError("tile_size должен быть положительным целым числом или null")
        elif step_type == "interpolate":
            if set(parameters) != {"target_fps"}:
                raise ValueError("Для interpolate требуется только target_fps")
            target_fps = parameters["target_fps"]
            if (
                isinstance(target_fps, bool)
                or not isinstance(target_fps, (int, float))
                or not math.isfinite(target_fps)
                or target_fps <= 0
            ):
                raise ValueError("target_fps должен быть положительным конечным числом")
        elif step_type == "color_correct":
            mode = parameters.get("mode")
            if mode not in ("preset", "smart"):
                raise ValueError("mode должен быть preset или smart")
            allowed = {"mode", "sharpness"}
            if mode == "preset":
                allowed.add("preset")
            if set(parameters) - allowed:
                raise ValueError("Недопустимые параметры color_correct")
            sharpness = parameters.get("sharpness", 0)
            if (
                isinstance(sharpness, bool)
                or not isinstance(sharpness, int)
                or not 0 <= sharpness <= 100
            ):
                raise ValueError("Резкость должна быть целым числом от 0 до 100")
            if mode == "preset":
                preset = parameters.get("preset")
                if preset is not None:
                    if not isinstance(preset, str) or preset not in COLOR_PRESETS:
                        raise ValueError(
                            "Недопустимый пресет коррекции цвета. "
                            f"Допустимые пресеты: {', '.join(COLOR_PRESETS)}"
                        )
                elif sharpness <= 0:
                    raise ValueError("Требуется пресет коррекции или резкость")
        elif step_type == "format":
            if set(parameters) != {"platform", "resolution"}:
                raise ValueError("Для format требуются параметры platform и resolution")
            if parameters["platform"] not in ["youtube", "tiktok", "vk"]:
                raise ValueError("Платформа должна быть youtube, tiktok или vk")
            if not isinstance(parameters["resolution"], str):
                raise ValueError("resolution должен быть строкой")
        return parameters


class ColorPreviewRequest(BaseModel):
    mode: Literal["preset", "smart"] = "preset"
    preset: str | None = None
    sharpness: int = Field(default=0, ge=0, le=100)


class JobCreate(BaseModel):
    video_id: UUID
    steps: list[StepInput] = Field(min_length=1)

    @field_validator("steps")
    @classmethod
    def order_steps(cls, steps: list[StepInput]) -> list[StepInput]:
        """Always run interpolate, then upscale, then color correction."""
        return sorted(steps, key=lambda step: STEP_ORDER.get(step.type, len(STEP_ORDER)))


class StepResponse(APIModel):
    type: str
    status: str
    parameters: dict[str, Any]
    progress: float
    started_at: datetime | None
    finished_at: datetime | None
    error: dict[str, Any] | None


class JobResponse(APIModel):
    id: UUID
    video_id: UUID
    status: str
    steps: list[StepResponse]
    progress: float
    current_step: int | None
    message: str | None
    result_id: UUID | None
    error: dict[str, Any] | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ResultResponse(APIModel):
    id: UUID
    job_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    duration_seconds: float | None
    width: int | None
    height: int | None
    fps: float | None
    download_url: str
    created_at: datetime

class ExportJobCreate(BaseModel):
    profile_id: str
    adaptation_mode: Literal["crop", "pad", "blur"]
    fps_override: Literal["source"] | int | None = "source"
    job_id: UUID | None = None

class ExportJobResponse(APIModel):
    id: UUID
    video_id: UUID
    job_id: UUID | None
    profile_id: str
    adaptation_mode: str
    status: str
    progress: float
    output_path: str | None
    error_code: str | None
    user_message: str | None
    created_at: datetime

class ProjectResponse(APIModel):
    id: UUID
    video_id: UUID
    video_filename: str
    status: str
    steps: list[StepResponse]
    progress: float
    current_step: int | None
    message: str | None
    result_id: UUID | None
    error: dict[str, Any] | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    exports: list[ExportJobResponse]
    download_url: str | None

class ProjectPage(APIModel):
    items: list[ProjectResponse]
    total: int
    limit: int
    offset: int
