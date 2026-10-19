"""Wait for the database endpoint before running Alembic migrations."""

import os
import socket
import sys
import time

from sqlalchemy.engine import make_url


database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("DATABASE_URL is not set", file=sys.stderr)
    sys.exit(1)

url = make_url(database_url)
host = url.host or "postgres"
port = url.port or 5432
deadline = time.monotonic() + 90
last_error = None

while time.monotonic() < deadline:
    try:
        with socket.create_connection((host, port), timeout=3):
            print(f"PostgreSQL is reachable at {host}:{port}")
            sys.exit(0)
    except OSError as error:
        last_error = error
        print(f"Waiting for PostgreSQL at {host}:{port}: {error}", flush=True)
        time.sleep(2)

print(f"PostgreSQL did not become reachable at {host}:{port}: {last_error}", file=sys.stderr)
sys.exit(1)
