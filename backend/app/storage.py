from pathlib import Path
from uuid import UUID


def user_storage_root(storage_root: Path, user_id: UUID) -> Path:
    return storage_root / "users" / str(user_id)


def user_relative_path(user_id: UUID, *parts: str) -> Path:
    return Path("users", str(user_id), *parts)


def user_directory(storage_root: Path, user_id: UUID, name: str) -> Path:
    path = user_storage_root(storage_root, user_id) / name
    path.mkdir(parents=True, exist_ok=True)
    return path
