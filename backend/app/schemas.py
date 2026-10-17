import math
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


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
    type: Literal["upscale", "interpolate"]
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
        return parameters


class JobCreate(BaseModel):
    video_id: UUID
    steps: list[StepInput] = Field(min_length=1)


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
