"""Deterministic color correction with one global LUT for the whole video.

Preset modes use a fixed set of parameters. Smart mode estimates contrast and
white balance from a few sampled frames and then applies the same LUT to every
frame, so exposure never flickers between frames.
"""

import logging
from pathlib import Path

import cv2
import numpy as np

from audio import finalize_video
from cancellation import ProcessingCancelled, is_cancelled
from progress import clear_progress, write_progress

logger = logging.getLogger("ai.color_corrector")

# Values are deliberately mild: correction is a finishing step, not a filter.
# temperature > 1 warms the image, < 1 cools it; tint acts on green.
PRESETS = {
    "natural": {
        "brightness": 2.0, "contrast": 1.06, "gamma": 1.0,
        "saturation": 1.08, "temperature": 1.0, "tint": 1.0,
    },
    "cinema": {
        "brightness": -4.0, "contrast": 1.15, "gamma": 1.02,
        "saturation": 0.95, "temperature": 0.97, "tint": 1.0,
    },
    "vivid": {
        "brightness": 1.0, "contrast": 1.18, "gamma": 1.02,
        "saturation": 1.25, "temperature": 1.0, "tint": 1.0,
    },
    "warm": {
        "brightness": 3.0, "contrast": 1.05, "gamma": 1.0,
        "saturation": 1.08, "temperature": 1.08, "tint": 1.0,
    },
    "cool": {
        "brightness": 1.0, "contrast": 1.06, "gamma": 1.0,
        "saturation": 1.05, "temperature": 0.92, "tint": 1.0,
    },
}

SMART_SAMPLES = 60
SMART_THUMBNAIL = (160, 90)


def _build_lut(
    brightness: float = 0.0,
    contrast: float = 1.0,
    gamma: float = 1.0,
    gains_bgr=(1.0, 1.0, 1.0),
    pivot: float = 128.0,
) -> np.ndarray:
    """Return a 1x256x3 uint8 LUT in BGR channel order."""
    values = np.arange(256, dtype=np.float32)
    mapped = (values - pivot) * contrast + pivot + brightness
    mapped = np.clip(mapped, 0.0, 255.0) / 255.0
    if gamma != 1.0:
        mapped = np.power(mapped, 1.0 / gamma)
    # OpenCV expects a 1 x 256 array with one value per input channel.
    return np.stack([
        np.clip(np.rint(mapped * gain * 255.0), 0, 255).astype(np.uint8)
        for gain in gains_bgr
    ], axis=-1)[np.newaxis, :, :]


def _saturation_matrix(saturation: float) -> np.ndarray:
    weights = (0.114, 0.587, 0.299)  # BGR luma weights
    matrix = np.empty((3, 3), dtype=np.float32)
    for row in range(3):
        for column in range(3):
            matrix[row][column] = (
                weights[column] + (1.0 - weights[column]) * saturation
                if row == column
                else weights[column] * (1.0 - saturation)
            )
    return matrix


SHARPNESS_MAX_STRENGTH = 20.0


def apply_sharpness(frame: np.ndarray, sharpness: int | float) -> np.ndarray:
    """Unsharp mask using only OpenCV — no extra models or dependencies."""
    amount = SHARPNESS_MAX_STRENGTH * float(sharpness or 0) / 100.0
    if amount <= 0:
        return frame
    blurred = cv2.GaussianBlur(frame, (0, 0), 1.0)
    return cv2.addWeighted(frame, 1.0 + amount, blurred, -amount, 0)


def apply_correction(
    frame: np.ndarray,
    lut: np.ndarray | None,
    matrix: np.ndarray | None,
    sharpness: int | float = 0,
) -> np.ndarray:
    """Apply saturation, the global LUT and optional sharpening to one frame."""
    if matrix is not None:
        frame = cv2.transform(frame, matrix)
    if lut is not None:
        frame = cv2.LUT(frame, lut)
    return apply_sharpness(frame, sharpness)


def build_preset_lut(preset: str) -> tuple[np.ndarray, np.ndarray | None]:
    params = PRESETS[preset]
    temperature = params["temperature"]
    gains = (
        1.0 / temperature,
        params["tint"],
        temperature,
    )
    lut = _build_lut(
        brightness=params["brightness"],
        contrast=params["contrast"],
        gamma=params["gamma"],
        gains_bgr=gains,
    )
    saturation = params["saturation"]
    matrix = _saturation_matrix(saturation) if saturation != 1.0 else None
    return lut, matrix


def build_smart_lut(cap) -> tuple[np.ndarray, np.ndarray | None]:
    """Estimate a single stable LUT from frames spread across the video."""
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, total // SMART_SAMPLES) if total > 0 else 1
    samples: list[np.ndarray] = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, SMART_THUMBNAIL, interpolation=cv2.INTER_AREA)
        samples.append(small.astype(np.float32))
        if step > 1:
            cap.set(cv2.CAP_PROP_POS_FRAMES, min(total, int(cap.get(cv2.CAP_PROP_POS_FRAMES)) + step - 1))

    if not samples:
        return _build_lut(), None

    pixels = np.concatenate([sample.reshape(-1, 3) for sample in samples], axis=0)
    luma = pixels @ np.array([0.114, 0.587, 0.299], dtype=np.float32)
    low, high = np.percentile(luma, (1.0, 99.0))
    spread = max(1.0, float(high) - float(low))
    contrast = min(2.0, max(1.0, 239.0 / spread))
    brightness = 8.0 - float(low) * contrast

    channel_means = pixels.mean(axis=0)
    target = float(channel_means.mean())
    gains = tuple(
        float(np.clip(target / max(float(mean), 1.0), 0.85, 1.15))
        for mean in channel_means
    )
    lut = _build_lut(
        brightness=brightness,
        contrast=contrast,
        gains_bgr=gains,
        pivot=0.0,
    )
    return lut, _saturation_matrix(1.08)


def build_correction(
    input_path: str,
    mode: str,
    preset: str | None,
) -> tuple[np.ndarray, np.ndarray | None]:
    if mode == "smart":
        sample_cap = cv2.VideoCapture(input_path)
        try:
            return build_smart_lut(sample_cap)
        finally:
            sample_cap.release()
    # No preset means neutral colour; sharpness is applied separately.
    if not preset:
        return None, None
    return build_preset_lut(preset)


def make_preview_frames(
    input_path: str,
    mode: str,
    preset: str | None,
    sharpness: int | float = 0,
) -> tuple[np.ndarray, np.ndarray]:
    """Read one representative frame and return it before/after correction."""
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise IOError(f"Cannot open input video: {input_path}")
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        target = int(total * 0.15) if total > 1 else 0
        if target > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, target)
        ok, before = cap.read()
        if not ok and target > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, before = cap.read()
    finally:
        cap.release()
    if not ok:
        raise ValueError("Video has no decodable frames")

    lut, matrix = build_correction(input_path, mode, preset if mode == "preset" else None)
    return before, apply_correction(before, lut, matrix, sharpness)


class VideoColorCorrector:
    def process(
        self,
        input_path: str,
        output_path: str,
        mode: str = "preset",
        preset: str | None = None,
        sharpness: int | float = 0,
        cancel_uri: str | None = None,
    ) -> dict:
        if mode not in ("preset", "smart"):
            raise ValueError("mode must be preset or smart")
        if mode == "preset" and preset is not None and preset not in PRESETS:
            raise ValueError(f"unknown color preset: {preset}")
        if is_cancelled(cancel_uri):
            raise ProcessingCancelled("Обработка отменена")

        logger.info(
            "ColorCorrector.start: mode=cpu, dtype=uint8, correction=%s, preset=%s, sharpness=%s",
            mode,
            preset if mode == "preset" else "auto",
            sharpness,
        )

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise IOError(f"Cannot open input video: {input_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if fps <= 0 or not np.isfinite(fps):
            cap.release()
            raise ValueError("Source FPS is zero")

        lut, matrix = build_correction(input_path, mode, preset if mode == "preset" else None)

        output = Path(output_path)
        silent_path = output.with_name(f".{output.stem}.silent{output.suffix}")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(str(silent_path), fourcc, fps, (width, height))

        processed = 0
        report_every = max(1, total_frames // 100) if total_frames > 0 else 1
        try:
            while True:
                if is_cancelled(cancel_uri):
                    raise ProcessingCancelled("Обработка отменена")
                ok, frame = cap.read()
                if not ok:
                    break
                out.write(apply_correction(frame, lut, matrix, sharpness))
                processed += 1
                if processed % report_every == 0:
                    write_progress(output_path, processed, total_frames)
                    logger.info(
                        "[color_correct] %d/%d frames, correction=%s",
                        processed, total_frames, mode,
                    )
            write_progress(output_path, processed, total_frames)
        except ProcessingCancelled:
            clear_progress(output_path)
            silent_path.unlink(missing_ok=True)
            raise
        finally:
            cap.release()
            out.release()

        audio_added = finalize_video(input_path, silent_path, output)
        clear_progress(output_path)
        frame_count = total_frames if total_frames > 0 else processed

        return {
            "status": "completed",
            "output_uri": output_path,
            "width": width,
            "height": height,
            "fps": fps,
            "duration_seconds": frame_count / fps,
            "size_bytes": Path(output_path).stat().st_size if Path(output_path).exists() else 0,
            "audio_preserved": audio_added,
            "correction": mode,
            "preset": preset if mode == "preset" else None,
        }
