import asyncio
import subprocess
import sys

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.engine import make_url

from app.api.v1.endpoints.auth import session_cookie_samesite
from app.core.config import BACKEND_DIR, Settings, settings
from app.main import app


async def request(method, path, **kwargs):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health(path):
    response = asyncio.run(request("GET", path))
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_only_configured_origin():
    origin = str(settings.frontend_origin).rstrip("/")
    allowed = asyncio.run(
        request(
            "OPTIONS",
            "/api/v1/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
    )
    denied = asyncio.run(
        request(
            "OPTIONS",
            "/api/v1/health",
            headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
        )
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == origin
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


def test_configuration_is_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = Settings(_env_file=None, database_url="sqlite:///./data/route53.db")
    assert make_url(config.database_url).database == str(BACKEND_DIR / "data" / "route53.db")
    assert Settings.model_config["env_file"] == BACKEND_DIR / ".env"
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_origin="https://example.com/path")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="postgresql://localhost/route53")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", session_cookie_secure=False)


def test_secure_session_cookie_supports_cross_site_frontend(monkeypatch):
    monkeypatch.setattr(settings, "session_cookie_secure", False)
    assert session_cookie_samesite() == "lax"
    monkeypatch.setattr(settings, "session_cookie_secure", True)
    assert session_cookie_samesite() == "none"


def test_database_connection_enforces_foreign_keys_without_creating_tables(tmp_path, monkeypatch):
    # A separate process isolates cached settings and never opens the development database.
    database_path = tmp_path / "isolated" / "foundation.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.db.session import engine; "
            "from app.db.base import Base; "
            "connection = engine.connect(); "
            "assert connection.exec_driver_sql('PRAGMA foreign_keys').scalar_one() == 1; "
            'assert connection.exec_driver_sql("SELECT name FROM sqlite_master '
            "WHERE type='table'\").all() == []; "
            "assert not Base.metadata.tables; "
            "connection.close(); engine.dispose()",
        ],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert database_path.is_file()
