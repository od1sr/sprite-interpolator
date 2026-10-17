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
