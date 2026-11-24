# syntax=docker/dockerfile:1
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    MODEL_PATH=/app/weights

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir poetry==2.5.1

WORKDIR /app
COPY ai/pyproject.toml ai/poetry.lock ./

# Separate layer: re-used until pyproject.toml / poetry.lock change.
RUN --mount=type=cache,id=ai-poetry,target=/root/.cache/pypoetry \
    --mount=type=cache,id=ai-pip,target=/root/.cache/pip \
    poetry config installer.max-workers 1 \
    && poetry config requests.max-retries 5 \
    && poetry install --only main --no-root --no-interaction

# Separate layer: changing the patch script or model code does not invalidate
# the dependency layer above.
COPY ai/patch_basicsr.sh /usr/local/bin/patch-basicsr
RUN --mount=type=cache,id=ai-downloads,target=/tmp/ai-downloads \
    --mount=type=cache,id=ai-pip,target=/root/.cache/pip \
    chmod +x /usr/local/bin/patch-basicsr \
    && mkdir -p /tmp/BasicSR-src \
    && if [ ! -f /tmp/ai-downloads/basicsr.tar.gz ]; then \
        curl -fsSL https://github.com/XPixelGroup/BasicSR/archive/refs/tags/v1.4.2.tar.gz \
          -o /tmp/ai-downloads/basicsr.tar.gz; \
    fi \
    && tar -xzf /tmp/ai-downloads/basicsr.tar.gz --strip-components=1 -C /tmp/BasicSR-src \
    && /usr/local/bin/patch-basicsr /tmp/BasicSR-src \
    && BASICSR_EXT=False pip install --no-build-isolation /tmp/BasicSR-src \
    && pip install realesrgan==0.3.0 \
    && /usr/local/bin/patch-basicsr \
    && rm -rf /tmp/BasicSR-src

# FFmpeg/ffprobe are used to put the source audio track back into processed
# videos. Kept in a separate layer so the heavy dependency layers stay cached.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY ai/ ./

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
