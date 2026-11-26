import logging
import re
import subprocess
from collections.abc import Callable
from pathlib import Path

from app.media import probe_video

logger = logging.getLogger(__name__)

_OUT_TIME_RE = re.compile(r"^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$")


def _parse_out_time(value: str) -> float | None:
    """Parse FFmpeg's `out_time=HH:MM:SS.microseconds` into seconds."""
    match = _OUT_TIME_RE.match(value.strip())
    if match is None:
        return None
    hours, minutes, seconds = match.groups()
    try:
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    except ValueError:
        return None


def build_ffmpeg_command(input_path: Path, output_path: Path, profile: dict, mode: str) -> list[str]:
    width = profile["width"]
    height = profile["height"]
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-c:v",
        profile["video_codec"],
        "-pix_fmt",
        "yuv420p",
        "-crf",
        str(profile["crf"]),
        "-c:a",
        profile["audio_codec"],
        "-b:a",
        profile["audio_bitrate"],
        "-movflags",
        "+faststart",
    ]

    if mode == "crop":
        video_filter = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height}"
        )
        command.extend(["-vf", video_filter])
    elif mode == "pad":
        video_filter = (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black"
        )
        command.extend(["-vf", video_filter])
    elif mode == "blur":
        filter_complex = (
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},gblur=sigma=20[bg];"
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )
        command.extend(["-filter_complex", filter_complex])
    else:
        raise ValueError(f"Неизвестный режим адаптации: {mode}")

    command.append(str(output_path))
    return command


def run_ffmpeg_export(
    input_path: Path,
    output_path: Path,
    profile: dict,
    mode: str,
    *,
    progress_callback: Callable[[float], None] | None = None,
    duration_seconds: float | None = None,
) -> None:
    command = build_ffmpeg_command(input_path, output_path, profile, mode)
    logger.info("Запуск FFmpeg: %s", " ".join(command))

    total = duration_seconds
    if progress_callback is not None:
        command[-1:-1] = ["-progress", "pipe:1", "-nostats", "-loglevel", "error"]
        if total is None or total <= 0:
            try:
                total = probe_video(input_path).get("duration_seconds")
            except Exception:
                logger.warning("Не удалось определить длительность для прогресса экспорта", exc_info=True)

    try:
        text_mode = progress_callback is not None
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=text_mode,
        )

        if progress_callback is not None and total is not None and total > 0 and process.stdout is not None:
            last = 0.0
            for line in process.stdout:
                key, separator, value = line.strip().partition("=")
                if not separator or key != "out_time":
                    continue
                seconds = _parse_out_time(value)
                if seconds is None:
                    continue
                percent = min(99.0, max(0.0, seconds / total * 100))
                if percent >= last + 0.5:
                    last = percent
                    progress_callback(percent)

        _, stderr = process.communicate()
        if process.returncode != 0:
            logger.error("FFmpeg failed: %s", stderr)
            raise RuntimeError("Ошибка FFmpeg при экспорте видео")
    except Exception:
        logger.exception("Не удалось запустить FFmpeg")
        raise
