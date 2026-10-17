#!/usr/bin/env python3
"""Deploy and run the Sprite Interpolator stack locally (Windows).

Starts PostgreSQL, Redis, Backend API, Celery worker, AI service and Frontend,
installing dependencies and applying database migrations along the way.

Usage:
    python deploy.py                 # full stack
    python deploy.py --only backend  # backend + worker + dependencies
    python deploy.py --only frontend
    python deploy.py --only infra    # postgres + redis only
    python deploy.py --skip-install  # skip poetry/npm installs
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "deploy" / "logs"

SCOOP = Path(os.environ.get("USERPROFILE", "")) / "scoop"
PG_BIN = SCOOP / "apps" / "postgresql" / "current" / "bin"
PG_DATA = SCOOP / "persist" / "postgresql" / "data"
PG_LOG = LOG_DIR / "postgres.log"
REDIS_BIN = SCOOP / "apps" / "redis" / "current" / "redis-server.exe"

BACKEND_DIR = ROOT / "backend"
AI_DIR = ROOT / "ai"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_PORT = 8000
AI_PORT = 8001
FRONTEND_PORT = 5173
PG_PORT = 5432
REDIS_PORT = 6379

DB_NAME = "sprite_interpolator"
DB_USER = "sprite"
DB_PASSWORD = "sprite"

_PROCESSES: list[subprocess.Popen] = []


def log(msg: str) -> None:
    print(f"[deploy] {msg}", flush=True)


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> None:
    log(f"run: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=str(cwd or ROOT), env=env, check=True)


def port_open(port: int, host: str = "127.0.0.1", timeout: float = 1.0) -> bool:
    for family, addr in (
        (socket.AF_INET, ("127.0.0.1", port)),
        (socket.AF_INET6, ("::1", port)),
    ):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                if sock.connect_ex(addr) == 0:
                    return True
        except OSError:
            continue
    return False


def wait_for_port(port: int, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_open(port):
            return True
        time.sleep(0.5)
    return False


def http_ok(url: str, timeout: float = 5.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def wait_for_http(url: str, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if http_ok(url):
            return True
        time.sleep(1.0)
    return False


def which(name: str) -> str | None:
    return shutil.which(name)


def scoop_install(*packages: str) -> None:
    scoop = which("scoop")
    if not scoop:
        log("WARNING: scoop not found; cannot auto-install packages")
        return
    run([scoop, "install", *packages])


def start_background(cmd: list[str], cwd: Path, log_name: str) -> subprocess.Popen:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = open(LOG_DIR / log_name, "w", encoding="utf-8")
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    _PROCESSES.append(proc)
    log(f"started pid={proc.pid} -> {LOG_DIR / log_name}")
    return proc


def ensure_file(path: Path, template: Path) -> None:
    if not path.exists() and template.exists():
        shutil.copyfile(template, path)
        log(f"created {path} from {template.name}")


# --------------------------------------------------------------------------- #
# Infrastructure
# --------------------------------------------------------------------------- #
def start_postgres(skip_install: bool) -> None:
    if port_open(PG_PORT):
        log(f"PostgreSQL already listening on {PG_PORT}")
        return

    if not (PG_BIN / "pg_ctl.exe").exists():
        if skip_install:
            log("ERROR: PostgreSQL not installed and --skip-install set")
            return
        log("installing PostgreSQL via scoop...")
        scoop_install("postgresql")

    if not (PG_BIN / "pg_ctl.exe").exists():
        log("ERROR: PostgreSQL binaries not found after install")
        return

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log("starting PostgreSQL...")
    subprocess.run(
        [
            str(PG_BIN / "pg_ctl.exe"),
            "start",
            "-D",
            str(PG_DATA),
            "-l",
            str(PG_LOG),
            "-w",
        ],
        check=False,
    )
    if wait_for_port(PG_PORT):
        log(f"PostgreSQL is up on {PG_PORT}")
    else:
        log("WARNING: PostgreSQL did not start in time; check deploy/logs/postgres.log")


def start_redis(skip_install: bool) -> None:
    if port_open(REDIS_PORT):
        log(f"Redis already listening on {REDIS_PORT}")
        return

    if not REDIS_BIN.exists():
        if skip_install:
            log("ERROR: Redis not installed and --skip-install set")
            return
        log("installing Redis via scoop...")
        scoop_install("redis")

    if not REDIS_BIN.exists():
        log("ERROR: Redis binary not found after install")
        return

    log("starting Redis...")
    start_background([str(REDIS_BIN), "--port", str(REDIS_PORT)], ROOT, "redis.log")
    if wait_for_port(REDIS_PORT):
        log(f"Redis is up on {REDIS_PORT}")
    else:
        log("WARNING: Redis did not start in time")


def setup_database() -> None:
    psql = PG_BIN / "psql.exe"
    if not psql.exists():
        log("WARNING: psql not found; skipping database setup")
        return

    sql = LOG_DIR / "setup_db.sql"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    sql.write_text(
        "DO $$\n"
        "BEGIN\n"
        "  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sprite') THEN\n"
        "    CREATE ROLE sprite LOGIN PASSWORD 'sprite' SUPERUSER;\n"
        "  END IF;\n"
        "END\n"
        "$$;\n",
        encoding="utf-8",
    )
    env = dict(os.environ, PGPASSWORD="")
    subprocess.run(
        [str(psql), "-U", "postgres", "-h", "localhost", "-p", str(PG_PORT),
         "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", str(sql)],
        env=env,
        check=False,
    )
    subprocess.run(
        [str(psql), "-U", "postgres", "-h", "localhost", "-p", str(PG_PORT),
         "-d", "postgres", "-tAc",
         f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'"],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    # Create database if missing (CREATE DATABASE cannot run inside a transaction).
    check = subprocess.run(
        [str(psql), "-U", "postgres", "-h", "localhost", "-p", str(PG_PORT),
         "-d", "postgres", "-tAc",
         f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'"],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if check.stdout.strip() != "1":
        subprocess.run(
            [str(psql), "-U", "postgres", "-h", "localhost", "-p", str(PG_PORT),
             "-d", "postgres", "-c", f"CREATE DATABASE {DB_NAME} OWNER {DB_USER};"],
            env=env,
            check=False,
        )
    log(f"database '{DB_NAME}' ready")


# --------------------------------------------------------------------------- #
# Services
# --------------------------------------------------------------------------- #
def poetry_cmd() -> list[str]:
    poetry = which("poetry")
    if not poetry:
        log("ERROR: poetry not found on PATH")
        sys.exit(1)
    return [poetry, "run"]


def run_backend(skip_install: bool, with_worker: bool) -> None:
    ensure_file(BACKEND_DIR / ".env", BACKEND_DIR / ".env.example")
    if not skip_install:
        run(["poetry", "install", "--no-interaction"], cwd=BACKEND_DIR)

    if not wait_for_port(PG_PORT, timeout=1.0) or not port_open(REDIS_PORT):
        log("ERROR: PostgreSQL/Redis must be running before backend")
        return

    log("applying database migrations...")
    run(["poetry", "run", "alembic", "upgrade", "head"], cwd=BACKEND_DIR)

    if port_open(BACKEND_PORT):
        log(f"Backend already listening on {BACKEND_PORT}")
    else:
        log("starting Backend API...")
        start_background(
            poetry_cmd() + ["python", "-m", "uvicorn", "main:app",
                            "--host", "0.0.0.0", "--port", str(BACKEND_PORT)],
            BACKEND_DIR,
            "backend.log",
        )
        wait_for_http(f"http://localhost:{BACKEND_PORT}/health")

    if with_worker:
        log("starting Celery worker...")
        start_background(
            poetry_cmd() + ["celery", "-A", "app.queue.celery_app", "worker",
                             "--loglevel=info", "--pool=solo"],
            BACKEND_DIR,
            "worker.log",
        )


def run_ai(skip_install: bool) -> None:
    ensure_file(AI_DIR / ".env", AI_DIR / ".env.example")
    if not skip_install:
        run(["poetry", "install", "--no-interaction"], cwd=AI_DIR)

    if port_open(AI_PORT):
        log(f"AI service already listening on {AI_PORT}")
        return

    log("starting AI service...")
    start_background(
        poetry_cmd() + ["python", "-m", "uvicorn", "main:app",
                         "--host", "0.0.0.0", "--port", str(AI_PORT)],
        AI_DIR,
        "ai.log",
    )
    wait_for_http(f"http://localhost:{AI_PORT}/health")


def run_frontend(skip_install: bool) -> None:
    ensure_file(FRONTEND_DIR / ".env", FRONTEND_DIR / ".env.example")
    if not skip_install:
        npm = which("npm") or which("npm.cmd")
        if not npm:
            log("ERROR: npm not found on PATH")
            return
        run([npm, "install"], cwd=FRONTEND_DIR)

    if port_open(FRONTEND_PORT):
        log(f"Frontend already listening on {FRONTEND_PORT}")
    else:
        npm = which("npm") or which("npm.cmd")
        if not npm:
            log("ERROR: npm not found on PATH")
            return
        start_background([npm, "run", "dev"], FRONTEND_DIR, "frontend.log")
        if not wait_for_port(FRONTEND_PORT, timeout=30):
            log("WARNING: frontend did not start in time")
            return

    url = f"http://localhost:{FRONTEND_PORT}"
    log(f"opening browser at {url}")
    webbrowser.open(url)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["infra", "backend", "ai", "frontend", "all"],
                        default="all")
    parser.add_argument("--skip-install", action="store_true",
                        help="skip poetry/npm dependency installation")
    parser.add_argument("--no-worker", action="store_true",
                        help="do not start the Celery worker")
    args = parser.parse_args()

    LOG_DIR.mkdir(parents=True, exist_ok=True)

    try:
        if args.only in {"infra", "all"}:
            start_postgres(args.skip_install)
            start_redis(args.skip_install)
            setup_database()

        if args.only in {"backend", "all"}:
            run_backend(args.skip_install, with_worker=not args.no_worker)

        if args.only in {"ai", "all"}:
            run_ai(args.skip_install)

        if args.only in {"frontend", "all"}:
            run_frontend(args.skip_install)
    except KeyboardInterrupt:
        log("interrupted; stopping started services")
    finally:
        for proc in _PROCESSES:
            if proc.poll() is None:
                proc.terminate()

    log("done")


if __name__ == "__main__":
    main()
