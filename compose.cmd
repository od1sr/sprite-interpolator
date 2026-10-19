@echo off
cd /d "%~dp0"

if not exist .env (
    copy /Y .env.example .env >nul
    if errorlevel 1 exit /b 1
    echo Created .env from .env.example
)

if "%~1"=="" (
    docker compose up --build
) else (
    docker compose %*
)

exit /b %ERRORLEVEL%
