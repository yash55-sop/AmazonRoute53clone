from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.base import Base

ZoneType = Literal["PUBLIC", "PRIVATE"]
RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Persist SQLite datetimes while restoring explicit UTC on reads."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return aware.replace(tzinfo=None) if dialect.name == "sqlite" else aware

    def process_result_value(self, value: datetime | None, _) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(timezone=True), default=utcnow)

    sessions: Mapped[list[Session]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    hosted_zones: Mapped[list[HostedZone]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="sessions")


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    __table_args__ = (
        CheckConstraint("zone_type IN ('PUBLIC', 'PRIVATE')", name="ck_zone_type"),
        UniqueConstraint("user_id", "name", name="uq_hosted_zone_user_name"),
        Index("ix_hosted_zones_user_name", "user_id", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(253), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    zone_type: Mapped[str] = mapped_column(String(10), default="PUBLIC")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="hosted_zones")
    records: Mapped[list[DNSRecord]] = relationship(
        back_populates="hosted_zone",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def record_count(self) -> int:
        return len(self.records)


class DNSRecord(Base):
    __tablename__ = "dns_records"
    __table_args__ = (
        CheckConstraint(
            "type IN ('A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA')",
            name="ck_dns_record_type",
        ),
        CheckConstraint("ttl > 0", name="ck_dns_record_ttl_positive"),
        CheckConstraint("routing_policy = 'SIMPLE'", name="ck_dns_routing_policy"),
        Index("ix_dns_records_zone_name", "hosted_zone_id", "name"),
        Index("ix_dns_records_zone_type", "hosted_zone_id", "type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    hosted_zone_id: Mapped[int] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(253), index=True)
    type: Mapped[str] = mapped_column(String(5), index=True)
    value: Mapped[str] = mapped_column(Text)
    ttl: Mapped[int] = mapped_column(Integer)
    routing_policy: Mapped[str] = mapped_column(String(20), default="SIMPLE")
    is_alias: Mapped[bool] = mapped_column(Boolean, default=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    hosted_zone: Mapped[HostedZone] = relationship(back_populates="records")
