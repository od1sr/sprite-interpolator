from pathlib import Path

import pytest

from app import exporter
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


class _FakeStdout:
    def __init__(self, lines: list[str]):
        self.lines = lines

    def __iter__(self):
        return iter(self.lines)


class _FakeProcess:
    def __init__(self, lines: list[str]):
        self.stdout = _FakeStdout(lines)
        self.stderr = ""
        self.returncode = 0

    def communicate(self):
        return "", ""


def test_run_ffmpeg_export_streams_progress(monkeypatch: pytest.MonkeyPatch):
    commands: list[list[str]] = []
    seen: list[float] = []
    lines = [
        "frame=1\n",
        "out_time=00:00:02.500000\n",
        "progress=continue\n",
        "out_time=00:00:05.000000\n",
        "progress=continue\n",
        "out_time=00:00:12.000000\n",
        "progress=end\n",
    ]

    def fake_popen(command, **kwargs):
        commands.append(command)
        return _FakeProcess(lines)

    monkeypatch.setattr(exporter.subprocess, "Popen", fake_popen)

    exporter.run_ffmpeg_export(
        Path("input.mp4"),
        Path("output.mp4"),
        EXPORT_PROFILES["youtube_standard_v1"],
        "crop",
        progress_callback=seen.append,
        duration_seconds=10.0,
    )

    assert "-progress" in commands[0]
    assert seen == [25.0, 50.0, 99.0]
