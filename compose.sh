#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo 'Created .env from .env.example'
fi

if [[ $# -eq 0 ]]; then
  set -- up --build
fi

exec docker compose "$@"
