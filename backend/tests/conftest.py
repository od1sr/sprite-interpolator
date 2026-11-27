from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, hash_password
from app.database import Base, get_session
from app.main import app
from app.models import User

TEST_USERNAME = "testuser"
TEST_PASSWORD = "password123"


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, sessionmaker]]:
    from app import api, auth, main
    from app.config import Settings

    test_settings = Settings(
        database_url="sqlite://",
        storage_root=tmp_path / "storage",
        secret_key="test-secret-key-with-at-least-32-bytes",
    )
    monkeypatch.setattr(api, "settings", test_settings)
    monkeypatch.setattr(auth, "settings", test_settings)
    monkeypatch.setattr(main, "settings", test_settings)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_sessions = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_session():
        with test_sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with test_sessions.begin() as session:
        user = User(
            username=TEST_USERNAME,
            password_hash=hash_password(TEST_PASSWORD),
            display_name="Test User",
        )
        session.add(user)

    with TestClient(app) as test_client:
        test_client.cookies.set(test_settings.auth_cookie_name, create_access_token(user.id))
        yield test_client, test_sessions
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def user(client):
    _, sessions = client
    with sessions() as session:
        return session.scalar(select(User).where(User.username == TEST_USERNAME))
