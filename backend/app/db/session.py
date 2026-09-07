import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import settings

database_url = make_url(settings.database_url)
Path(database_url.database).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False, "autocommit": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "connect")
def enable_foreign_keys(connection: sqlite3.Connection, _: ConnectionPoolEntry) -> None:
    # SQLite requires this PRAGMA outside a transaction, on every new connection.
    previous_autocommit = connection.autocommit
    connection.autocommit = True
    try:
        connection.execute("PRAGMA foreign_keys=ON").close()
    finally:
        connection.autocommit = previous_autocommit


def init_database() -> None:
    """Create the current schema and idempotently provision the demo account."""
    from app.db.base import Base
    from app.models import User  # noqa: F401 - registers all model metadata
    from app.services.auth import ensure_demo_user

    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("dns_records")}
    if "is_system" not in columns:
        default_ns = "\n".join(
            (
                "ns-146.awsdns-clone.com.",
                "ns-833.awsdns-clone.net.",
                "ns-291.awsdns-clone.org.",
                "ns-1844.awsdns-clone.co.uk.",
            )
        )
        default_soa = (
            "ns-146.awsdns-clone.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
        )
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE dns_records ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0")
            )
            connection.execute(
                text(
                    "UPDATE dns_records SET is_system = 1 "
                    "WHERE hosted_zone_id IN ("
                    "SELECT id FROM hosted_zones "
                    "WHERE hosted_zones.name = dns_records.name "
                    "AND hosted_zones.zone_type = 'PUBLIC'"
                    ") AND ((type = 'NS' AND ttl = 172800 AND value = :default_ns) "
                    "OR (type = 'SOA' AND ttl = 900 AND value = :default_soa))"
                ),
                {"default_ns": default_ns, "default_soa": default_soa},
            )
    with SessionLocal() as session:
        ensure_demo_user(session)
