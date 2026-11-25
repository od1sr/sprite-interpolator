import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://sprite:sprite@localhost:5432/sprite_interpolator",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ai_service_url: str = os.getenv("AI_SERVICE_URL", "http://localhost:8001").rstrip("/")
    storage_root: Path = Path(os.getenv("STORAGE_ROOT", "storage")).resolve()
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(2 * 1024**3)))
    allowed_extensions: frozenset[str] = frozenset({".mp4", ".mov", ".webm"})
    ffprobe_path: str = os.getenv("FFPROBE_PATH", "ffprobe")
    ai_timeout_seconds: float = float(os.getenv("AI_TIMEOUT_SECONDS", "3600"))

    def __post_init__(self) -> None:
        if not 1 <= self.port <= 65535:
            raise ValueError("PORT must be between 1 and 65535")
        if self.max_upload_bytes <= 0:
            raise ValueError("MAX_UPLOAD_BYTES must be a positive integer")
        if self.ai_timeout_seconds <= 0:
            raise ValueError("AI_TIMEOUT_SECONDS must be positive")


settings = Settings()

# app/config.py

EXPORT_PROFILES = {
    "tiktok_vertical_v1": {
        "profile_id": "tiktok_vertical_v1",
        "platform": "tiktok",
        "content_type": "vertical",
        "version": 1,
        "container": "mp4",
        "video_codec": "libx264",
        "audio_codec": "aac",
        "width": 1080,
        "height": 1920,
        "aspect_ratio": "9:16",
        "fps_mode": "source",
        "quality_mode": "crf",
        "crf": 23,
        "audio_bitrate": "128k",
        "allowed_modes": ["crop", "pad", "blur"]
    },
    "youtube_standard_v1": {
        "profile_id": "youtube_standard_v1",
        "platform": "youtube",
        "content_type": "standard",
        "version": 1,
        "container": "mp4",
        "video_codec": "libx264",
        "audio_codec": "aac",
        "width": 1920,
        "height": 1080,
        "aspect_ratio": "16:9",
        "fps_mode": "source",
        "quality_mode": "crf",
        "crf": 18,
        "audio_bitrate": "192k",
        "allowed_modes": ["crop", "pad", "blur"]
    },
    "instagram_square_v1": {
        "profile_id": "instagram_square_v1",
        "platform": "instagram",
        "content_type": "square",
        "version": 1,
        "container": "mp4",
        "video_codec": "libx264",
        "audio_codec": "aac",
        "width": 1080,
        "height": 1080,
        "aspect_ratio": "1:1",
        "fps_mode": "source",
        "quality_mode": "crf",
        "crf": 20,
        "audio_bitrate": "160k",
        "allowed_modes": ["crop", "pad", "blur"]
    },
    "instagram_feed_v1": {
        "profile_id": "instagram_feed_v1",
        "platform": "instagram",
        "content_type": "feed_portrait",
        "version": 1,
        "container": "mp4",
        "video_codec": "libx264",
        "audio_codec": "aac",
        "width": 1080,
        "height": 1350,
        "aspect_ratio": "4:5",
        "fps_mode": "source",
        "quality_mode": "crf",
        "crf": 20,
        "audio_bitrate": "160k",
        "allowed_modes": ["crop", "pad", "blur"]
    }
}
