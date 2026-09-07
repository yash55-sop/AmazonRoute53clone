from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./data/route53.db"
    frontend_origin: AnyHttpUrl = "http://localhost:3000"
    session_cookie_secure: bool = False
    session_cookie_name: str = "route53_session"
    session_lifetime_seconds: int = 60 * 60 * 24

    @field_validator("database_url")
    @classmethod
    def resolve_database_url(cls, value: str) -> str:
        try:
            url = make_url(value)
        except ArgumentError as exc:
            raise ValueError("DATABASE_URL must be a valid SQLAlchemy SQLite URL") from exc
        if (
            url.drivername not in {"sqlite", "sqlite+pysqlite"}
            or not url.database
            or url.database == ":memory:"
            or url.host
            or url.username
            or url.query
        ):
            raise ValueError(
                "DATABASE_URL must name a local SQLite file: sqlite:///./data/route53.db"
            )
        path = Path(url.database)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return url.set(database=str(path.resolve())).render_as_string(hide_password=False)

    @field_validator("frontend_origin")
    @classmethod
    def validate_frontend_origin(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if (
            value.path not in {None, "/"}
            or value.query
            or value.fragment
            or value.username
            or value.password
            or "*" in (value.host or "")
        ):
            raise ValueError(
                "FRONTEND_ORIGIN must be one HTTP(S) origin without a path or wildcard"
            )
        return value

    @field_validator("session_lifetime_seconds")
    @classmethod
    def validate_session_lifetime(cls, value: int) -> int:
        if value < 60:
            raise ValueError("SESSION_LIFETIME_SECONDS must be at least 60")
        return value

    @model_validator(mode="after")
    def require_secure_production_cookie(self) -> "Settings":
        if self.app_env == "production" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true in production")
        return self


settings = Settings()
