#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo 'Created .env from .env.example'
fi

compose_files=()
# Explicit deployment settings take precedence over local GPU detection.
if [[ -z "${COMPOSE_FILE:-}" ]] && ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?COMPOSE_FILE=.' .env; then
  compose_files=(-f compose.yaml)
  if [[ -f compose.override.yaml ]]; then
    compose_files+=(-f compose.override.yaml)
  fi
  if command -v nvidia-ctk >/dev/null && nvidia-ctk cdi list 2>/dev/null | grep -Fx 'nvidia.com/gpu=1' >/dev/null; then
    compose_files+=(-f compose.gpu.cdi.yaml)
  elif command -v nvidia-smi >/dev/null; then
    compose_files+=(-f compose.gpu.yaml)
  fi
fi

if [[ $# -eq 0 ]]; then
  set -- up --build
fi

exec docker compose "${compose_files[@]}" "$@"
