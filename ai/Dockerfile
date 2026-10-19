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
COPY ai/patch_basicsr.sh /usr/local/bin/patch-basicsr
RUN chmod +x /usr/local/bin/patch-basicsr
RUN poetry config installer.max-workers 1 \
    && poetry config requests.max-retries 5 \
    && poetry install --only main --no-root --no-interaction \
    && mkdir -p /tmp/BasicSR-src \
    && curl -fsSL https://github.com/XPixelGroup/BasicSR/archive/refs/tags/v1.4.2.tar.gz -o /tmp/basicsr.tar.gz \
    && tar -xzf /tmp/basicsr.tar.gz --strip-components=1 -C /tmp/BasicSR-src \
    && /usr/local/bin/patch-basicsr /tmp/BasicSR-src \
    && BASICSR_EXT=False pip install --no-build-isolation /tmp/BasicSR-src \
    && pip install --no-cache-dir realesrgan==0.3.0 \
    && /usr/local/bin/patch-basicsr \
    && rm -rf /root/.cache/pypoetry /root/.cache/pip /tmp/BasicSR-src /tmp/basicsr.tar.gz
COPY ai/ ./

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
