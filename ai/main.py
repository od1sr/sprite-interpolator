# main.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging
import os
from contextlib import asynccontextmanager

from pathlib import Path

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
        ]
    }


@app.post("/internal/v1/upscale")
def upscale(request_data: dict):
    input_uri = request_data.get("input_uri")
    output_uri = request_data.get("output_uri")
    params = request_data.get("params", {})

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
        return upscaler_model.process(input_uri, output_uri)
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
        return interpolator_model.process(input_uri, output_uri, target_fps)
    except ValueError as e:
        return _error(400, "bad_params", str(e))
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            return _error(507, "cuda_oom", f"CUDA OOM: {e}")
        return _error(500, "processing_failed", str(e))
    except Exception as e:
        return _error(500, "processing_failed", str(e))
