import math
import re
import secrets
import string

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import DNSRecord, HostedZone, User
from app.schemas import HostedZoneCreate, HostedZoneUpdate

ID_ALPHABET = string.ascii_uppercase + string.digits
DOMAIN_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")
DEFAULT_NS = (
    "ns-146.awsdns-clone.com.",
    "ns-833.awsdns-clone.net.",
    "ns-291.awsdns-clone.org.",
    "ns-1844.awsdns-clone.co.uk.",
)


def domain_error(message: str) -> HTTPException:
    return HTTPException(status_code=422, detail={"code": "invalid_domain", "message": message})


def normalize_domain(name: str) -> str:
    candidate = name.strip().rstrip(".").lower()
    if not candidate or len(candidate) > 253 or "." not in candidate:
        raise domain_error("Enter a valid fully qualified domain name.")
    try:
        ascii_name = candidate.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise domain_error("Enter a valid domain name.") from exc
    if any(not DOMAIN_LABEL.fullmatch(label) for label in ascii_name.split(".")):
        raise domain_error("Enter a valid domain name.")
    return ascii_name


def make_id(prefix: str, length: int = 12) -> str:
    return prefix + "".join(secrets.choice(ID_ALPHABET) for _ in range(length))


def get_owned_zone(db: Session, user: User, zone_id: str) -> HostedZone:
    zone = db.scalar(
        select(HostedZone).where(HostedZone.zone_id == zone_id, HostedZone.user_id == user.id)
    )
    if zone is None:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone


def create_zone(db: Session, user: User, data: HostedZoneCreate) -> HostedZone:
    name = normalize_domain(data.name)
    if db.scalar(
        select(HostedZone.id).where(HostedZone.user_id == user.id, HostedZone.name == name)
    ):
        raise HTTPException(
            status_code=409,
            detail={"code": "zone_conflict", "message": "A hosted zone with this name exists."},
        )
    zone = HostedZone(
        zone_id=make_id("Z"),
        name=name,
        description=data.description,
        zone_type=data.zone_type,
        user_id=user.id,
    )
    try:
        db.add(zone)
        db.flush()
        if zone.zone_type == "PUBLIC":
            db.add_all(
                [
                    DNSRecord(
                        record_id=make_id("R"),
                        hosted_zone_id=zone.id,
                        name=name,
                        type="NS",
                        value="\n".join(DEFAULT_NS),
                        ttl=172800,
                        routing_policy="SIMPLE",
                        is_alias=False,
                        is_system=True,
                    ),
                    DNSRecord(
                        record_id=make_id("R"),
                        hosted_zone_id=zone.id,
                        name=name,
                        type="SOA",
                        value=(
                            f"{DEFAULT_NS[0]} awsdns-hostmaster.amazon.com. "
                            "1 7200 900 1209600 86400"
                        ),
                        ttl=900,
                        routing_policy="SIMPLE",
                        is_alias=False,
                        is_system=True,
                    ),
                ]
            )
        db.commit()
        db.refresh(zone)
        return zone
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Hosted zone conflicts with existing data"
        ) from exc


def list_zones(
    db: Session,
    user: User,
    search: str | None,
    zone_type: str | None,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> dict:
    filters = [HostedZone.user_id == user.id]
    if search and search.strip():
        filters.append(HostedZone.name.ilike(f"%{search.strip()}%"))
    if zone_type:
        filters.append(HostedZone.zone_type == zone_type.upper())
    total = db.scalar(select(func.count()).select_from(HostedZone).where(*filters)) or 0
    columns = {
        "name": HostedZone.name,
        "created_at": HostedZone.created_at,
        "updated_at": HostedZone.updated_at,
    }
    order = columns[sort_by].desc() if sort_order == "desc" else columns[sort_by].asc()
    items = list(
        db.scalars(
            select(HostedZone)
            .where(*filters)
            .order_by(order, HostedZone.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": math.ceil(total / page_size),
    }


def update_zone(db: Session, zone: HostedZone, data: HostedZoneUpdate) -> HostedZone:
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        new_name = normalize_domain(changes["name"])
        conflict = db.scalar(
            select(HostedZone.id).where(
                HostedZone.user_id == zone.user_id,
                HostedZone.name == new_name,
                HostedZone.id != zone.id,
            )
        )
        if conflict:
            raise HTTPException(status_code=409, detail="A hosted zone with this name exists")
        old_name = zone.name
        zone.name = new_name
        for record in zone.records:
            if record.name == old_name:
                record.name = new_name
    for field in ("description", "zone_type"):
        if field in changes and changes[field] is not None:
            setattr(zone, field, changes[field])
    db.commit()
    db.refresh(zone)
    return zone


def delete_zone(db: Session, zone: HostedZone) -> None:
    db.delete(zone)
    db.commit()
