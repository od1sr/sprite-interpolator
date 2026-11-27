"""Deterministic token pricing for processing jobs.

The frontend only displays these numbers; the API recomputes them before
charging so a modified client cannot choose a cheaper price.
"""

from math import ceil, isfinite, sqrt
from typing import Any, Mapping

# Effective frame height of a 16:9 frame with the same pixel count. Non-standard
# aspect ratios are therefore compared with the standard categories by area.
RESOLUTION_TIERS = (
    (480, 0.5, "480p"),
    (720, 0.75, "720p"),
    (1080, 1.0, "1080p"),
    (1440, 1.5, "1440p"),
    (2160, 2.5, "2160p"),
)
MAX_SOURCE_FPS = 120.0

OPERATION_COEFFICIENTS = {
    "interpolate": 1.0,
    "upscale": 1.5,
    "color_correct": 0.5,
}


class PricingError(ValueError):
    """A video cannot be priced (and therefore cannot be processed)."""

    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def resolution_coefficient(width: int | None, height: int | None) -> dict[str, Any]:
    """Choose K_resolution from the frame dimensions, not from a profile name."""
    if not width or not height or width <= 0 or height <= 0:
        raise PricingError(
            "INVALID_RESOLUTION",
            "Не удалось определить разрешение исходного видео",
            {"width": width, "height": height},
        )

    pixels = int(width) * int(height)
    effective_height = round(sqrt(pixels * 9 / 16))
    for limit, coefficient, label in RESOLUTION_TIERS:
        if effective_height <= limit:
            return {
                "label": label,
                "width": int(width),
                "height": int(height),
                "pixels": pixels,
                "effective_height": effective_height,
                "coefficient": coefficient,
            }
    raise PricingError(
        "UNSUPPORTED_RESOLUTION",
        "Разрешение видео превышает технические ограничения продукта",
        {
            "width": int(width),
            "height": int(height),
            "pixels": pixels,
            "max_effective_height": RESOLUTION_TIERS[-1][0],
        },
    )


def fps_coefficient(fps: float | None) -> float:
    """Choose K_fps by numeric value; fractional rates use their exact value."""
    if fps is None or not isfinite(float(fps)) or float(fps) <= 0:
        raise PricingError("INVALID_FPS", "Не удалось определить частоту кадров исходного видео", {"fps": fps})
    value = float(fps)
    if value <= 30:
        return 1.0
    if value <= 60:
        return 1.5
    if value <= MAX_SOURCE_FPS:
        return 2.5
    raise PricingError(
        "UNSUPPORTED_FPS",
        "Частота кадров видео превышает технические ограничения продукта",
        {"fps": value, "max_fps": MAX_SOURCE_FPS},
    )


def estimate_job_cost(video: Mapping[str, Any], steps: list[dict[str, Any]]) -> dict[str, Any]:
    """Return the full price breakdown for a processing job."""
    duration_seconds = video.get("duration_seconds")
    duration = float(duration_seconds) if duration_seconds is not None else 0.0
    if not isfinite(duration) or duration <= 0:
        raise PricingError(
            "INVALID_DURATION",
            "Не удалось определить длительность исходного видео",
            {"duration_seconds": duration_seconds},
        )

    resolution = resolution_coefficient(video.get("width"), video.get("height"))
    fps_value = video.get("fps")
    k_fps = fps_coefficient(fps_value)
    fps = float(fps_value)

    operations = []
    for step in steps:
        step_type = step.get("type")
        coefficient = OPERATION_COEFFICIENTS.get(step_type, 0.0)
        operations.append({"type": step_type, "coefficient": coefficient})
    k_operations = sum(item["coefficient"] for item in operations)
    if k_operations <= 0:
        raise PricingError("NO_OPERATIONS", "Не выбраны операции обработки")

    duration_minutes = duration / 60
    credits = ceil(100 * duration_minutes * resolution["coefficient"] * k_fps * k_operations)
    return {
        "duration_seconds": duration,
        "duration_minutes": duration_minutes,
        "resolution": resolution["label"],
        "resolution_pixels": resolution["pixels"],
        "k_resolution": resolution["coefficient"],
        "fps": fps,
        "k_fps": k_fps,
        "operations": operations,
        "k_operations": k_operations,
        "credits": credits,
    }
