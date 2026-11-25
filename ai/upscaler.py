# upscaler.py
import cv2
import logging
import numpy as np
import torch
from pathlib import Path
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from typing import Optional

from audio import finalize_video
from cancellation import ProcessingCancelled, is_cancelled
from progress import clear_progress, write_progress

logger = logging.getLogger("ai.upscaler")


class VideoUpscaler:
    """Обертка над Real-ESRGAN для апскейла видео."""

    def __init__(self, model_path: str, scale: int = 4, tile_size: int = 0, device: str = "cuda"):
        """
        Args:
            model_path: Путь к файлу весов модели (.pth).
            scale: Коэффициент увеличения (2 или 4).
            tile_size: Размер тайла для обработки больших кадров (0 = отключено).
            device: 'cuda' или 'cpu'.
        """
        self.scale = scale
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")

        # Определяем архитектуру на основе имени файла модели
        model_name = Path(model_path).stem
        if "animevideov3" in model_name:
            # Архитектура для видео-моделей (SRVGGNetCompact)
            from realesrgan.archs.srvgg_arch import SRVGGNetCompact
            model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4, act_type='prelu')
        else:
            # Стандартная архитектура RRDBNet
            model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)

        # Инициализируем enhancer
        self.half = torch.cuda.is_available()
        self.upsampler = RealESRGANer(
            scale=scale,
            model_path=model_path,
            model=model,
            tile=tile_size,        # 0 = без тайлинга, иначе 256/400/512
            tile_pad=10,
            pre_pad=0,
            half=self.half,  # FP16 только на GPU; на CPU нужен FP32
            device=self.device
        )
        logger.info(
            "VideoUpscaler инициализирован: device=%s, half=%s",
            self.device,
            self.half,
        )

    def process(self, input_path: str, output_path: str, cancel_uri: str | None = None) -> dict:
        """
        Обрабатывает видео: читает, апскейлит каждый кадр, записывает результат.
        Возвращает метаданные выходного файла.
        """
        logger.info("Upscale.start: device=%s, dtype=%s", self.device, "fp16" if self.half else "fp32")
        if is_cancelled(cancel_uri):
            raise ProcessingCancelled("Обработка отменена")
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise IOError(f"Не удалось открыть входное видео: {input_path}")

        # Получаем свойства исходного видео
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Новые размеры
        out_width = width * self.scale
        out_height = height * self.scale

        # VideoWriter пишет только кадры, поэтому сначала сохраняем "немое"
        # видео во временный файл, а затем добавляем звук через FFmpeg.
        output = Path(output_path)
        silent_path = output.with_name(f".{output.stem}.silent{output.suffix}")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # или 'avc1' для H.264
        out = cv2.VideoWriter(str(silent_path), fourcc, fps, (out_width, out_height))
        if not out.isOpened():
            raise IOError(f"Не удалось открыть выходное видео: {silent_path}")

        processed_frames = 0
        report_every = max(1, total_frames // 100)
        try:
            while True:
                if is_cancelled(cancel_uri):
                    raise ProcessingCancelled("Обработка отменена")
                ret, frame = cap.read()
                if not ret:
                    break

                # Real-ESRGAN ожидает BGR-изображение (как у OpenCV)
                try:
                    output_frame, _ = self.upsampler.enhance(frame, outscale=self.scale)
                except RuntimeError as e:
                    # Если не хватает памяти, можно попробовать уменьшить tile_size
                    print(f"Ошибка при обработке кадра: {e}. Попробуйте уменьшить tile_size.")
                    raise

                out.write(output_frame)
                processed_frames += 1

                if processed_frames % report_every == 0:
                    write_progress(output_path, processed_frames, total_frames)
                    print(f"Обработано кадров: {processed_frames}/{total_frames}")

            write_progress(output_path, processed_frames, total_frames)
        except ProcessingCancelled:
            clear_progress(output_path)
            silent_path.unlink(missing_ok=True)
            raise
        finally:
            cap.release()
            out.release()

        audio_added = finalize_video(input_path, silent_path, output)
        clear_progress(output_path)

        # Собираем метаданные результата
        result = {
            "status": "completed",
            "output_uri": output_path,
            "width": out_width,
            "height": out_height,
            "fps": fps,
            "duration_seconds": total_frames / fps if fps > 0 else 0,
            "size_bytes": output.stat().st_size if output.exists() else 0,
            "audio_preserved": audio_added,
        }
        return result
