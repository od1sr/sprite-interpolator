import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.errors import APIError
from app import media


def test_probe_video_extracts_duration_dimensions_fps_and_codec(monkeypatch, tmp_path: Path):
    output = {
        "format": {"duration": "12.5"},
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "30000/1001",
            }
        ],
    }
    monkeypatch.setattr(
        media.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(stdout=json.dumps(output)),
    )

    metadata = media.probe_video(tmp_path / "video.mp4")

    assert metadata == {
        "duration_seconds": 12.5,
        "width": 1920,
        "height": 1080,
        "fps": pytest.approx(29.97002997),
        "codec": "h264",
    }


def test_probe_video_translates_invalid_video_errors(monkeypatch, tmp_path: Path):
    def fail(*args, **kwargs):
        raise subprocess.CalledProcessError(1, args[0])

    monkeypatch.setattr(media.subprocess, "run", fail)
    with pytest.raises(APIError) as error:
        media.probe_video(tmp_path / "invalid.mp4")
    assert error.value.status_code == 422
    assert error.value.code == "VALIDATION_ERROR"
