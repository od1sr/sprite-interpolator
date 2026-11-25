from pathlib import Path


class ProcessingCancelled(Exception):
    """AI processing was cancelled by the backend."""


def is_cancelled(cancel_uri: str | None) -> bool:
    return bool(cancel_uri and Path(cancel_uri).exists())
