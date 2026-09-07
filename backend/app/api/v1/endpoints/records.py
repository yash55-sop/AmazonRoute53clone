from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_demo_user
from app.models import User
from app.schemas import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    DNSRecordCreate,
    DNSRecordPage,
    DNSRecordResponse,
    DNSRecordUpdate,
    RecordType,
    ZoneImportRequest,
    ZoneImportResponse,
)
from app.services import records, zones

router = APIRouter(prefix="/hosted-zones/{zone_id}/records", tags=["DNS records"])


@router.get("", response_model=DNSRecordPage)
def list_dns_records(
    zone_id: str,
    search: str | None = None,
    record_type: RecordType | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: Literal["name", "type", "ttl", "created_at"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> dict:
    zone = zones.get_owned_zone(db, user, zone_id)
    return records.list_records(db, zone, search, record_type, page, page_size, sort_by, sort_order)


@router.post("", response_model=DNSRecordResponse, status_code=status.HTTP_201_CREATED)
def create_dns_record(
    zone_id: str,
    data: DNSRecordCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> DNSRecordResponse:
    zone = zones.get_owned_zone(db, user, zone_id)
    record = records.create_record(db, zone, data)
    response.headers["Location"] = f"/api/v1/hosted-zones/{zone_id}/records/{record.record_id}"
    return record


@router.post("/import", response_model=ZoneImportResponse, status_code=status.HTTP_201_CREATED)
def import_zone_file(
    zone_id: str,
    data: ZoneImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> dict:
    zone = zones.get_owned_zone(db, user, zone_id)
    return {"imported": records.import_bind(db, zone, data.content)}


@router.get("/export")
def export_zone_file(
    zone_id: str,
    format: Literal["bind", "json"] = "bind",
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
):
    zone = zones.get_owned_zone(db, user, zone_id)
    if format == "bind":
        return PlainTextResponse(
            records.export_bind(db, zone),
            headers={"Content-Disposition": f'attachment; filename="{zone.name}.zone"'},
        )
    return records.list_records(db, zone, None, None, 1, 100, "name", "asc")["items"]


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_records(
    zone_id: str,
    data: BulkDeleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> dict:
    zone = zones.get_owned_zone(db, user, zone_id)
    deleted, skipped = records.bulk_delete(db, zone, data.ids)
    return {"deleted": deleted, "skipped": skipped}


@router.get("/{record_id}", response_model=DNSRecordResponse)
def get_dns_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> DNSRecordResponse:
    zone = zones.get_owned_zone(db, user, zone_id)
    return records.get_record(db, zone, record_id)


@router.put("/{record_id}", response_model=DNSRecordResponse)
def update_dns_record(
    zone_id: str,
    record_id: str,
    data: DNSRecordUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> DNSRecordResponse:
    zone = zones.get_owned_zone(db, user, zone_id)
    return records.update_record(db, zone, records.get_record(db, zone, record_id), data)


@router.delete("/{record_id}", status_code=204)
def delete_dns_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_demo_user),
) -> None:
    zone = zones.get_owned_zone(db, user, zone_id)
    records.delete_record(db, zone, records.get_record(db, zone, record_id))
