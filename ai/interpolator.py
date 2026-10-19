# interpolator.py
import cv2
import numpy as np
import torch
import math
from pathlib import Path
from typing import List
from safetensors.torch import load_file
import sys

RIFE_DIR = Path(__file__).resolve().parent / "weights" / "rife"
if not RIFE_DIR.exists():
    raise FileNotFoundError(f"RIFE weights dir not found: {RIFE_DIR}")
sys.path.insert(0, str(RIFE_DIR))

from interpolation_model import IFNet


class VideoInterpolator:
    """RIFE-based frame interpolation with recursive sub-frame generation."""

    RIFE_DIVISOR = 32  # RIFE requires H,W divisible by 32

    def __init__(self, model_path: str, device: str = "cuda"):
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        self.model = IFNet()
        state_dict = load_file(model_path)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device).eval()

    def _interpolate_pair(self, frame1: np.ndarray, frame2: np.ndarray) -> np.ndarray:
        """Single RIFE call: returns the frame at t=0.5 (BGR uint8)."""
        f1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        f2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

        t1 = torch.from_numpy(f1).permute(2, 0, 1).unsqueeze(0).to(self.device)
        t2 = torch.from_numpy(f2).permute(2, 0, 1).unsqueeze(0).to(self.device)

        _, _, H, W = t1.shape
        d = self.RIFE_DIVISOR
        ph = (d - H % d) % d
        pw = (d - W % d) % d
        if ph or pw:
            t1 = torch.nn.functional.pad(t1, [0, pw, 0, ph])
            t2 = torch.nn.functional.pad(t2, [0, pw, 0, ph])

        with torch.no_grad():
            mid = self.model(torch.cat([t1, t2], dim=1))

        if ph or pw:
            mid = mid[:, :, :H, :W]

        mid_np = mid.squeeze(0).permute(1, 2, 0).cpu().numpy()
        mid_np = (mid_np * 255.0).clip(0, 255).astype(np.uint8)
        return cv2.cvtColor(mid_np, cv2.COLOR_RGB2BGR)

    def _generate_between(self, a: np.ndarray, b: np.ndarray, level: int) -> List[np.ndarray]:
        """
        Generate 2^level - 1 frames between a (t=0) and b (t=1),
        evenly spaced and sorted by t:
          level=0 -> []
          level=1 -> [t=0.5]
          level=2 -> [t=0.25, t=0.5, t=0.75]
          level=3 -> [t=0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
        """
        if level <= 0:
            return []
        mid = self._interpolate_pair(a, b)
        if level == 1:
            return [mid]
        left = self._generate_between(a, mid, level - 1)
        right = self._generate_between(mid, b, level - 1)
        return left + [mid] + right

    def process(self, input_path: str, output_path: str, target_fps: float) -> dict:
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise IOError(f"Cannot open input video: {input_path}")

        source_fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if source_fps <= 0:
            cap.release()
            raise ValueError("Source FPS is zero")

        factor = int(round(target_fps / source_fps))

        if factor < 1:
            cap.release()
            raise ValueError(
                f"target_fps ({target_fps}) must be >= source_fps ({source_fps:.2f})"
            )

        if factor & (factor - 1) != 0:
            cap.release()
            raise ValueError(
                f"target_fps / source_fps = {factor}x is not a power of 2. "
                f"Supported multipliers: 1, 2, 4, 8, 16. "
                f"For source {source_fps:.2f} fps use target_fps in: "
                f"{source_fps:.2f}, {source_fps*2:.2f}, {source_fps*4:.2f}, {source_fps*8:.2f}"
            )

        if factor == 1 and abs(target_fps - source_fps) > 1.0:
            cap.release()
            raise ValueError(
                f"Source is {source_fps:.2f} fps, target {target_fps:.2f} fps — "
                f"ratio rounds to 1x (no interpolation). "
                f"Pick {source_fps:.2f} or {source_fps*2:.2f} / {source_fps*4:.2f} / {source_fps*8:.2f}"
            )

        level = int(math.log2(factor)) if factor > 1 else 0
        n_mid = (1 << level) - 1
        actual_fps = source_fps * factor

        # Edge case: single-frame video
        if total_frames < 2:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, actual_fps, (width, height))
            ret, frame = cap.read()
            if ret:
                out.write(frame)
            cap.release()
            out.release()
            return self._result(output_path, width, height, actual_fps,
                                total_frames / source_fps, source_fps, factor, n_mid)

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, actual_fps, (width, height))

        ret, prev = cap.read()
        if not ret:
            cap.release()
            out.release()
            raise IOError("Video has no decodable frames")

        out.write(prev)
        processed = 0
        report_every = max(1, (total_frames - 1) // 10)

        try:
            while True:
                ret, curr = cap.read()
                if not ret:
                    break
                if level > 0:
                    for m in self._generate_between(prev, curr, level):
                        out.write(m)
                out.write(curr)
                prev = curr.copy()
                processed += 1
                if processed % report_every == 0:
                    pct = 100 * processed // (total_frames - 1)
                    print(f"[interpolate] {processed}/{total_frames-1} pairs ({pct}%), factor={factor}x")
        finally:
            cap.release()
            out.release()

        return self._result(output_path, width, height, actual_fps,
                            total_frames / source_fps, source_fps, factor, n_mid)

    @staticmethod
    def _result(path, w, h, fps, dur, src_fps, factor, n_mid) -> dict:
        return {
            "status": "completed",
            "output_uri": path,
            "width": w,
            "height": h,
            "fps": fps,
            "duration_seconds": dur,
            "size_bytes": Path(path).stat().st_size if Path(path).exists() else 0,
            "source_fps": src_fps,
            "factor": factor,
            "n_interpolated_per_pair": n_mid,
        }
