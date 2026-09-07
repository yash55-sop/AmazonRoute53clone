from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared metadata for future ORM models, separate from HTTP response schemas."""
