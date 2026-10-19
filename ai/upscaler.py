# upscaler.py
import cv2
import numpy as np
import torch
import subprocess
import os
import tempfile
from pathlib import Path
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from typing import Optional


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
        self.upsampler = RealESRGANer(
            scale=scale,
            model_path=model_path,
            model=model,
            tile=tile_size,        # 0 = без тайлинга, иначе 256/400/512
            tile_pad=10,
            pre_pad=0,
            half=True,             # Использовать FP16 для ускорения на GPU
            device=self.device
        )

    def process(self, input_path: str, output_path: str) -> dict:
        """
        Обрабатывает видео: читает, апскейлит каждый кадр, записывает результат.
        Возвращает метаданные выходного файла.
        """
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

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # Сохраняем видео БЕЗ аудио во временный файл через OpenCV
        fd, temp_video = tempfile.mkstemp(suffix='_tmp.mp4')
        os.close(fd)

        try:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_video, fourcc, fps, (out_width, out_height))

            processed_frames = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                try:
                    output_frame, _ = self.upsampler.enhance(frame, outscale=self.scale)
                except RuntimeError as e:
                    print(f"Ошибка при обработке кадра: {e}. Попробуйте уменьшить tile_size.")
                    raise
                out.write(output_frame)
                processed_frames += 1
                if processed_frames % 100 == 0:
                    print(f"Обработано кадров: {processed_frames}/{total_frames}")
            cap.release()
            out.release()

            # Извлекаем аудио из исходного и склеиваем с обработанным видео
            audio_file = None
            try:
                fd_a, audio_file = tempfile.mkstemp(suffix='_audio.m4a')
                os.close(fd_a)
                # Копируем аудио без перекодирования если возможно
                extract_cmd = ['ffmpeg', '-y', '-i', input_path, '-vn', '-c:a', 'aac', audio_file]
                subprocess.run(extract_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                if os.path.exists(audio_file) and os.path.getsize(audio_file) > 0:
                    merge_cmd = ['ffmpeg', '-y', '-i', temp_video, '-i', audio_file,
                                 '-c:v', 'copy', '-c:a', 'copy', '-shortest', output_path]
                    subprocess.run(merge_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                else:
                    # Нет аудио или не удалось извлечь, просто копируем видео
                    import shutil
                    shutil.copy2(temp_video, output_path)
            finally:
                if audio_file and os.path.exists(audio_file):
                    try:
                        os.remove(audio_file)
                    except OSError:
                        pass

            result = {
                "status": "completed",
                "output_uri": output_path,
                "width": out_width,
                "height": out_height,
                "fps": fps,
                "duration_seconds": total_frames / fps if fps > 0 else 0,
                "size_bytes": Path(output_path).stat().st_size if Path(output_path).exists() else 0,
            }
            return result
        finally:
            try:
                if os.path.exists(temp_video):
                    os.remove(temp_video)
            except OSError:
                pass
