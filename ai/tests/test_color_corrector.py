"""Lightweight AI-side checks (stdlib unittest, no extra dependencies).

Run inside the AI container:
    python tests/test_color_corrector.py
"""

import sys
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from color_corrector import PRESETS, build_preset_lut, build_smart_lut  # noqa: E402


class FakeCapture:
    def __init__(self, frames):
        self.frames = frames
        self.index = 0

    def get(self, prop):
        if prop == cv2.CAP_PROP_FRAME_COUNT:
            return len(self.frames)
        if prop == cv2.CAP_PROP_FPS:
            return 30.0
        return 0.0

    def read(self):
        if self.index >= len(self.frames):
            return False, None
        frame = self.frames[self.index]
        self.index += 1
        return True, frame

    def set(self, _prop, value):
        self.index = int(value)
        return True


class ColorCorrectorTests(unittest.TestCase):
    def test_all_presets_produce_valid_luts(self):
        for name in PRESETS:
            with self.subTest(preset=name):
                lut, _ = build_preset_lut(name)
                self.assertEqual(lut.shape, (1, 256, 3))
                self.assertEqual(lut.dtype, np.uint8)
                self.assertGreaterEqual(int(lut.min()), 0)
                self.assertLessEqual(int(lut.max()), 255)

    def test_warm_and_cool_presets_shift_channels_in_opposite_directions(self):
        warm, _ = build_preset_lut("warm")
        cool, _ = build_preset_lut("cool")
        self.assertGreater(int(warm[0, 128, 2]), int(warm[0, 128, 0]))
        self.assertLess(int(cool[0, 128, 2]), int(cool[0, 128, 0]))

    def test_smart_mode_balances_a_color_cast_from_sampled_frames(self):
        base = np.linspace(40, 215, 160, dtype=np.float32)
        frame = np.zeros((90, 160, 3), dtype=np.uint8)
        frame[:, :, 0] = np.clip(base * 0.6, 0, 255)  # blue
        frame[:, :, 1] = np.clip(base * 0.9, 0, 255)  # green
        frame[:, :, 2] = np.clip(base * 1.4, 0, 255)  # red
        lut, matrix = build_smart_lut(FakeCapture([frame] * 4))
        self.assertEqual(lut.shape, (1, 256, 3))
        self.assertIsNotNone(matrix)
        self.assertLess(int(lut[0, 128, 2]), int(lut[0, 128, 0]))


if __name__ == "__main__":
    unittest.main()
