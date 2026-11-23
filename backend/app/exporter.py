import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


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


def run_ffmpeg_export(input_path: Path, output_path: Path, profile: dict, mode: str) -> None:
    command = build_ffmpeg_command(input_path, output_path, profile, mode)
    logger.info("Запуск FFmpeg: %s", " ".join(command))

    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        _, stderr = process.communicate()
        if process.returncode != 0:
            logger.error("FFmpeg failed: %s", stderr.decode())
            raise RuntimeError("Ошибка FFmpeg при экспорте видео")
    except Exception:
        logger.exception("Не удалось запустить FFmpeg")
        raise
