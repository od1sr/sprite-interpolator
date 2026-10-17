import json
import math
import subprocess
from fractions import Fraction
from pathlib import Path
from typing import Any

from app.config import settings
from app.errors import APIError


def probe_video(path: Path) -> dict[str, Any]:
    try:
        result = subprocess.run(
            [
                settings.ffprobe_path,
                "-v",
                "error",
                "-show_format",
                "-show_streams",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=True,
        )
        data = json.loads(result.stdout)
    except FileNotFoundError as exc:
        raise APIError(500, "INTERNAL_ERROR", "FFprobe недоступен на сервере") from exc
    except (subprocess.SubprocessError, json.JSONDecodeError) as exc:
        raise APIError(422, "VALIDATION_ERROR", "Файл не является читаемым видео") from exc

    stream = next((item for item in data.get("streams", []) if item.get("codec_type") == "video"), None)
    if stream is None:
        raise APIError(422, "VALIDATION_ERROR", "Файл не содержит видеопоток")
    raw_fps = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    try:
        fps = float(Fraction(raw_fps)) if raw_fps and raw_fps != "0/0" else None
    except (ValueError, ZeroDivisionError):
        fps = None
    raw_duration = data.get("format", {}).get("duration") or stream.get("duration")
    try:
        duration = float(raw_duration) if raw_duration is not None else None
    except (TypeError, ValueError):
        duration = None
    return {
        "duration_seconds": duration if duration is not None and math.isfinite(duration) else None,
        "width": stream.get("width"),
        "height": stream.get("height"),
        "fps": fps if fps is not None and math.isfinite(fps) else None,
        "codec": stream.get("codec_name"),
    }
