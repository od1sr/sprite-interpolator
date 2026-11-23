from pathlib import Path

import pytest

from app.config import EXPORT_PROFILES
from app.exporter import build_ffmpeg_command


@pytest.mark.parametrize(
    ("mode", "option", "expected_filter"),
    [
        ("crop", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"),
        ("pad", "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920"),
        ("blur", "-filter_complex", "[bg][fg]overlay=(W-w)/2:(H-h)/2"),
    ],
)
def test_export_command_applies_selected_orientation_and_adaptation(mode, option, expected_filter):
    profile = EXPORT_PROFILES["tiktok_vertical_v1"]

    command = build_ffmpeg_command(Path("input.mp4"), Path("output.mp4"), profile, mode)

    assert option in command
    assert expected_filter in command[command.index(option) + 1]
    assert command[-1] == "output.mp4"


def test_export_command_rejects_unknown_adaptation_mode():
    profile = EXPORT_PROFILES["youtube_standard_v1"]
    with pytest.raises(ValueError):
        build_ffmpeg_command(Path("input.mp4"), Path("output.mp4"), profile, "stretch")
