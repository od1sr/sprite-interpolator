#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo 'Created .env from .env.example'
fi

compose_files=(-f compose.yaml)
if command -v nvidia-smi >/dev/null 2>&1 && [[ -f compose.gpu.yaml ]]; then
  compose_files+=(-f compose.gpu.yaml)
fi

if [[ $# -eq 0 ]]; then
  set -- up --build
fi

exec docker compose "${compose_files[@]}" "$@"
