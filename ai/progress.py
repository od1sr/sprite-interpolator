"""Progress reporting shared with the backend through the storage volume."""

import json
import os
from pathlib import Path


def progress_path(output_path: str | Path) -> Path:
    return Path(f"{output_path}.progress")


def write_progress(output_path: str | Path, processed: int, total: int) -> None:
    """Atomically write how many frames of ``total`` have been processed."""
    if total <= 0:
        return
    path = progress_path(output_path)
    percent = min(100.0, max(0.0, round(processed / total * 100, 2)))
    temporary = Path(f"{path}.tmp")
    temporary.write_text(
        json.dumps({"processed": processed, "total": total, "percent": percent}),
        encoding="utf-8",
    )
    os.replace(temporary, path)


def clear_progress(output_path: str | Path) -> None:
    progress_path(output_path).unlink(missing_ok=True)
