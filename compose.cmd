@echo off
cd /d "%~dp0"

if not exist .env (
    copy /Y .env.example .env >nul
    if errorlevel 1 exit /b 1
    echo Created .env from .env.example
)

rem Pass the GPU override automatically when an NVIDIA GPU is available.
set "COMPOSE_FILES=-f compose.yaml"
where nvidia-smi >nul 2>&1
if not errorlevel 1 (
    if exist compose.gpu.yaml set "COMPOSE_FILES=%COMPOSE_FILES% -f compose.gpu.yaml"
)

if "%~1"=="" (
    docker compose %COMPOSE_FILES% up --build
) else (
    docker compose %COMPOSE_FILES% %*
)

exit /b %ERRORLEVEL%
