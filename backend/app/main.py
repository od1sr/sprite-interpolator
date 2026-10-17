from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import settings
from app.errors import install_error_handlers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    (settings.storage_root / "uploads").mkdir(parents=True, exist_ok=True)
    (settings.storage_root / "results").mkdir(parents=True, exist_ok=True)
    (settings.storage_root / "jobs").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Sprite Interpolator Backend",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
install_error_handlers(app)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
