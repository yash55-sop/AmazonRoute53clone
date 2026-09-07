import ipaddress
import math
import re

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DNSRecord, HostedZone
from app.schemas import DNSRecordCreate, DNSRecordUpdate
from app.services.zones import DOMAIN_LABEL, make_id


def normalize_record_name(name: str, zone_name: str) -> str:
    candidate = name.strip().rstrip(".").lower()
    if candidate in {"", "@"}:
        return zone_name
    if "." not in candidate:
        candidate = f"{candidate}.{zone_name}"
    try:
        candidate = candidate.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise HTTPException(status_code=422, detail="Invalid record name") from exc
    if len(candidate) > 253 or any(not DOMAIN_LABEL.fullmatch(x) for x in candidate.split(".")):
        raise HTTPException(status_code=422, detail="Invalid record name")
    if candidate != zone_name and not candidate.endswith(f".{zone_name}"):
        raise HTTPException(status_code=422, detail="Record name must belong to its hosted zone")
    return candidate


def validate_value(record_type: str, value: str) -> str:
    value = value.strip()
    try:
        if record_type == "A":
            ipaddress.IPv4Address(value)
        elif record_type == "AAAA":
            ipaddress.IPv6Address(value)
        elif record_type in {"CNAME", "NS", "PTR"}:
            host = value.rstrip(".").lower()
            if "." not in host or any(not DOMAIN_LABEL.fullmatch(x) for x in host.split(".")):
                raise ValueError
        elif record_type == "MX":
            priority, host = value.split(maxsplit=1)
            if not 0 <= int(priority) <= 65535 or "." not in host.rstrip("."):
                raise ValueError
        elif record_type == "CAA" and not re.fullmatch(
            r'\d{1,3}\s+(issue|issuewild|iodef)\s+".+"', value
        ):
            raise ValueError
        elif record_type == "SRV":
            priority, weight, port, host = value.split(maxsplit=3)
            if any(not 0 <= int(x) <= 65535 for x in (priority, weight, port)) or "." not in host:
                raise ValueError
        elif record_type in {"TXT", "SOA"} and not value:
            raise ValueError
    except (ValueError, ipaddress.AddressValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {record_type} record value") from exc
    return value


def validate_alias_value(value: str) -> str:
    target = value.strip().rstrip(".").lower()
    if "." not in target or any(not DOMAIN_LABEL.fullmatch(part) for part in target.split(".")):
        raise HTTPException(status_code=422, detail="Alias value must be a valid hostname")
    return value.strip()


def get_record(db: Session, zone: HostedZone, record_id: str) -> DNSRecord:
    record = db.scalar(
        select(DNSRecord).where(
            DNSRecord.record_id == record_id, DNSRecord.hosted_zone_id == zone.id
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="DNS record not found")
    return record


def create_record(db: Session, zone: HostedZone, data: DNSRecordCreate) -> DNSRecord:
    record = DNSRecord(
        record_id=make_id("R"),
        hosted_zone_id=zone.id,
        name=normalize_record_name(data.name, zone.name),
        type=data.type,
        value=(
            validate_alias_value(data.value)
            if data.is_alias
            else validate_value(data.type, data.value)
        ),
        ttl=data.ttl,
        routing_policy=data.routing_policy,
        is_alias=data.is_alias,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_records(
    db: Session,
    zone: HostedZone,
    search: str | None,
    record_type: str | None,
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> dict:
    filters = [DNSRecord.hosted_zone_id == zone.id]
    if search and search.strip():
        filters.append(DNSRecord.name.ilike(f"%{search.strip()}%"))
    if record_type:
        filters.append(DNSRecord.type == record_type.upper())
    total = db.scalar(select(func.count()).select_from(DNSRecord).where(*filters)) or 0
    columns = {
        "name": DNSRecord.name,
        "type": DNSRecord.type,
        "ttl": DNSRecord.ttl,
        "created_at": DNSRecord.created_at,
    }
    order = columns[sort_by].desc() if sort_order == "desc" else columns[sort_by].asc()
    items = list(
        db.scalars(
            select(DNSRecord)
            .where(*filters)
            .order_by(order, DNSRecord.id)
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


def update_record(
    db: Session, zone: HostedZone, record: DNSRecord, data: DNSRecordUpdate
) -> DNSRecord:
    if record.is_system:
        raise HTTPException(status_code=409, detail="Default NS and SOA records cannot be modified")
    changes = data.model_dump(exclude_unset=True)
    final_type = changes.get("type", record.type)
    if "name" in changes:
        record.name = normalize_record_name(changes.pop("name"), zone.name)
    final_alias = changes.get("is_alias", record.is_alias)
    if "value" in changes or "type" in changes or "is_alias" in changes:
        raw_value = changes.pop("value", record.value)
        record.value = (
            validate_alias_value(raw_value)
            if final_alias
            else validate_value(final_type, raw_value)
        )
    for field, value in changes.items():
        if value is not None:
            setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


def delete_record(db: Session, zone: HostedZone, record: DNSRecord) -> None:
    if record.is_system:
        raise HTTPException(status_code=409, detail="System DNS records cannot be deleted")
    db.delete(record)
    db.commit()


BIND_PATTERN = re.compile(
    r"^(?P<name>\S+)\s+(?P<ttl>\d+)\s+IN\s+"
    r"(?P<type>A|AAAA|CNAME|TXT|MX|NS|PTR|SRV|CAA)\s+(?P<value>.+)$",
    re.IGNORECASE,
)


def import_bind(db: Session, zone: HostedZone, content: str) -> int:
    pending: list[DNSRecord] = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("$"):
            continue
        match = BIND_PATTERN.fullmatch(line)
        if match is None:
            raise HTTPException(
                status_code=422, detail=f"Invalid BIND record on line {line_number}"
            )
        record_type = match.group("type").upper()
        pending.append(
            DNSRecord(
                record_id=make_id("R"),
                hosted_zone_id=zone.id,
                name=normalize_record_name(match.group("name"), zone.name),
                type=record_type,
                value=validate_value(record_type, match.group("value")),
                ttl=int(match.group("ttl")),
                routing_policy="SIMPLE",
                is_alias=False,
            )
        )
    if not pending:
        raise HTTPException(status_code=422, detail="The zone file contains no supported records")
    try:
        db.add_all(pending)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return len(pending)


def export_bind(db: Session, zone: HostedZone) -> str:
    zone_records = db.scalars(
        select(DNSRecord).where(DNSRecord.hosted_zone_id == zone.id).order_by(DNSRecord.id)
    )
    return "\n".join(
        f"{record.name}. {record.ttl} IN {record.type} {record.value.replace(chr(10), ' ')}"
        for record in zone_records
    )


def bulk_delete(db: Session, zone: HostedZone, record_ids: list[str]) -> tuple[int, list[str]]:
    found = list(
        db.scalars(
            select(DNSRecord).where(
                DNSRecord.hosted_zone_id == zone.id, DNSRecord.record_id.in_(record_ids)
            )
        )
    )
    found_ids = {record.record_id for record in found}
    skipped = [record_id for record_id in record_ids if record_id not in found_ids]
    deletable = []
    for record in found:
        if record.is_system:
            skipped.append(record.record_id)
        else:
            deletable.append(record)
    for record in deletable:
        db.delete(record)
    db.commit()
    return len(deletable), skipped
