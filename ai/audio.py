"""Keep the source audio track when writing AI-processed videos.

OpenCV's VideoWriter only writes video frames, so the result of upscale /
interpolate is always silent. These helpers mux the original audio stream back
in with FFmpeg after the frames have been written.
"""

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger("ai.audio")


def has_audio(path: Path) -> bool:
    """Return True when *path* contains at least one audio stream."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "a:0",
                "-show_entries", "stream=index", "-of", "csv=p=0", str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        logger.warning("ffprobe не найден, проверить наличие звука не удалось")
        return False
    return result.returncode == 0 and bool(result.stdout.strip())


def attach_audio(source_path: str | Path, silent_path: str | Path, output_path: str | Path) -> bool:
    """Mux audio from *source_path* into the processed video at *silent_path*.

    The finished file is written atomically to *output_path*. Returns False when
    the source has no audio or FFmpeg is unavailable / fails.
    """
    source = Path(source_path)
    silent = Path(silent_path)
    target = Path(output_path)

    if not has_audio(source):
        logger.info("В исходном видео нет аудиодорожки: %s", source.name)
        return False

    temporary = target.with_name(f".{target.name}.with_audio{target.suffix}")
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(silent),
        "-i", str(source),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        # apad keeps audio going until the processed video ends; -shortest then
        # stops at the video length instead of truncating it to a shorter audio.
        "-af", "apad",
        "-shortest",
        "-movflags", "+faststart",
        str(temporary),
    ]

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        logger.warning("ffmpeg не найден, результат будет без звука")
        return False

    if result.returncode != 0:
        logger.warning("Не удалось добавить аудио: %s", result.stderr.strip()[-1000:])
        temporary.unlink(missing_ok=True)
        return False

    temporary.replace(target)
    logger.info("Аудиодорожка добавлена: %s", target.name)
    return True


def finalize_video(source_path: str | Path, silent_path: str | Path, output_path: str | Path) -> bool:
    """Place processed frames at *output_path*, preserving source audio if any."""
    silent = Path(silent_path)
    target = Path(output_path)
    try:
        if attach_audio(source_path, silent, target):
            return True
        silent.replace(target)
        return False
    finally:
        silent.unlink(missing_ok=True)
