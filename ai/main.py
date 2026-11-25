# main.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import base64
import logging
import os
from contextlib import asynccontextmanager

from pathlib import Path

import cv2

from cancellation import ProcessingCancelled
from color_corrector import (
    PRESETS as COLOR_PRESETS,
    VideoColorCorrector,
    make_preview_frames,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai")

upscaler_model = None
interpolator_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global upscaler_model, interpolator_model

    import torch

    cuda_available = torch.cuda.is_available()
    logger.info(
        "AI Service: torch=%s, CUDA доступен=%s, GPU=%d",
        torch.__version__,
        cuda_available,
        torch.cuda.device_count() if cuda_available else 0,
    )
    if cuda_available:
        logger.info("AI Service: обработка на GPU (%s)", torch.cuda.get_device_name(0))
    else:
        logger.info("AI Service: GPU недоступна в контейнере, обработка на CPU (FP32)")

    weights = Path(os.getenv("MODEL_PATH", "weights"))
    upscaler_weights = weights / "realesrgan" / "realesr-animevideov3.pth"
    interpolator_weights = weights / "rife" / "flownet.safetensors"

    # The service should remain usable for health checks when proprietary or
    # large model weights have not been installed in the deployment yet.
    if upscaler_weights.is_file():
        try:
            from upscaler import VideoUpscaler

            upscaler_model = VideoUpscaler(
                model_path=str(upscaler_weights), scale=4, tile_size=256, device="cuda"
            )
            logger.info("Real-ESRGAN загружена: device=%s", upscaler_model.device)
        except Exception as exc:
            logger.exception("Не удалось загрузить Real-ESRGAN: %s", exc)
    else:
        logger.warning("Веса Real-ESRGAN не найдены: %s", upscaler_weights)

    if interpolator_weights.is_file():
        try:
            from interpolator import VideoInterpolator

            interpolator_model = VideoInterpolator(
                model_path=str(interpolator_weights), device="cuda"
            )
            logger.info(
                "RIFE загружена: device=%s, dtype=%s",
                interpolator_model.device,
                interpolator_model.dtype,
            )
        except Exception as exc:
            logger.exception("Не удалось загрузить RIFE: %s", exc)
    else:
        logger.warning("Веса RIFE не найдены: %s", interpolator_weights)
    yield
    logger.info("Выключение сервиса.")


app = FastAPI(
    title="Sprite Interpolator AI Service",
    version="0.1.0",
    lifespan=lifespan,
)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": None}},
    )


@app.get("/internal/v1/health")
def health():
    return {"status": "ok"}


@app.get("/internal/v1/models")
def models():
    return {
        "models": [
            {"name": "realesrgan", "operation": "upscale",
             "available": upscaler_model is not None},
            {"name": "rife", "operation": "interpolate",
             "available": interpolator_model is not None},
            {"name": "lut", "operation": "color_correct",
             "available": True, "presets": list(COLOR_PRESETS)},
        ]
    }


@app.post("/internal/v1/upscale")
def upscale(request_data: dict):
    input_uri = request_data.get("input_uri")
    output_uri = request_data.get("output_uri")
    params = request_data.get("params", {})
    cancel_uri = request_data.get("cancel_uri")

    if not input_uri or not output_uri:
        return _error(400, "bad_request", "input_uri and output_uri are required")
    if not os.path.exists(input_uri):
        return _error(404, "input_not_found", f"input file not found: {input_uri}")
    if upscaler_model is None:
        return _error(503, "model_not_ready", "upscaler model is not loaded")

    scale = params.get("scale", 4)
    tile_size = params.get("tile_size")
    if scale not in (2, 4):
        return _error(400, "bad_params", "scale must be 2 or 4")
    if tile_size is not None and tile_size <= 0:
        return _error(400, "bad_params", "tile_size must be positive")

    try:
        return upscaler_model.process(input_uri, output_uri, cancel_uri)
    except ProcessingCancelled:
        return _error(409, "cancelled", "Обработка отменена")
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            return _error(507, "cuda_oom", f"CUDA OOM: {e}. Уменьшите tile_size.")
        return _error(500, "processing_failed", str(e))
    except Exception as e:
        return _error(500, "processing_failed", str(e))


@app.post("/internal/v1/interpolate")
def interpolate(request_data: dict):
    input_uri = request_data.get("input_uri")
    output_uri = request_data.get("output_uri")
    params = request_data.get("params", {})
    cancel_uri = request_data.get("cancel_uri")

    if not input_uri or not output_uri:
        return _error(400, "bad_request", "input_uri and output_uri are required")
    if not os.path.exists(input_uri):
        return _error(404, "input_not_found", f"input file not found: {input_uri}")
    if interpolator_model is None:
        return _error(503, "model_not_ready", "interpolator model is not loaded")

    target_fps = params.get("target_fps")
    if target_fps is None or target_fps <= 0:
        return _error(400, "bad_params", "target_fps must be positive")

    try:
        return interpolator_model.process(input_uri, output_uri, target_fps, cancel_uri)
    except ProcessingCancelled:
        return _error(409, "cancelled", "Обработка отменена")
    except ValueError as e:
        return _error(400, "bad_params", str(e))
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            return _error(507, "cuda_oom", f"CUDA OOM: {e}")
        return _error(500, "processing_failed", str(e))
    except Exception as e:
        return _error(500, "processing_failed", str(e))


@app.post("/internal/v1/color_correct")
def color_correct(request_data: dict):
    input_uri = request_data.get("input_uri")
    output_uri = request_data.get("output_uri")
    params = request_data.get("params", {})
    cancel_uri = request_data.get("cancel_uri")

    if not input_uri or not output_uri:
        return _error(400, "bad_request", "input_uri and output_uri are required")
    if not os.path.exists(input_uri):
        return _error(404, "input_not_found", f"input file not found: {input_uri}")

    mode = params.get("mode", "preset")
    if mode not in ("preset", "smart"):
        return _error(400, "bad_params", "mode must be preset or smart")
    preset = params.get("preset")
    if mode == "preset":
        if not isinstance(preset, str) or preset not in COLOR_PRESETS:
            return _error(
                400, "bad_params",
                f"unknown color preset: {preset}. Available: {', '.join(COLOR_PRESETS)}",
            )
    elif preset is not None:
        return _error(400, "bad_params", "preset is not allowed in smart mode")

    try:
        return VideoColorCorrector().process(
            input_uri, output_uri, mode=mode, preset=preset, cancel_uri=cancel_uri
        )
    except ProcessingCancelled:
        return _error(409, "cancelled", "Обработка отменена")
    except ValueError as e:
        return _error(400, "bad_params", str(e))
    except Exception as e:
        return _error(500, "processing_failed", str(e))


@app.post("/internal/v1/color_preview")
def color_preview(request_data: dict):
    """Return one frame before and after correction as base64 JPEGs."""
    input_uri = request_data.get("input_uri")
    if not input_uri:
        return _error(400, "bad_request", "input_uri is required")
    if not os.path.exists(input_uri):
        return _error(404, "input_not_found", f"input file not found: {input_uri}")

    params = request_data.get("params", {})
    mode = params.get("mode", "preset")
    preset = params.get("preset")
    if mode not in ("preset", "smart"):
        return _error(400, "bad_params", "mode must be preset or smart")
    if mode == "preset":
        if preset not in (None, "") and (
            not isinstance(preset, str) or preset not in COLOR_PRESETS
        ):
            return _error(400, "bad_params", f"unknown color preset: {preset}")
    elif preset is not None:
        return _error(400, "bad_params", "preset is not allowed in smart mode")

    try:
        before, after = make_preview_frames(input_uri, mode, preset)
        def encode(frame) -> str:
            ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
            if not ok:
                raise RuntimeError("JPEG encoding failed")
            return base64.b64encode(buffer.tobytes()).decode("ascii")

        return {
            "status": "completed",
            "before_base64": encode(before),
            "after_base64": encode(after),
            "width": before.shape[1],
            "height": before.shape[0],
        }
    except (ValueError, IOError) as e:
        return _error(400, "processing_failed", str(e))
    except Exception as e:
        return _error(500, "processing_failed", str(e))
