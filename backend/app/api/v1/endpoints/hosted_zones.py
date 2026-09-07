from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db, get_optional_current_user
from app.models import User
from app.schemas import HostedZoneCreate, HostedZonePage, HostedZoneResponse, HostedZoneUpdate
from app.services import zones
from app.services.auth import ensure_demo_user

router = APIRouter(prefix="/hosted-zones", tags=["hosted zones"])


@router.get("", response_model=HostedZonePage)
def list_hosted_zones(
    search: str | None = None,
    zone_type: Literal["PUBLIC", "PRIVATE"] | None = None,
    type_filter: Literal["PUBLIC", "PRIVATE"] | None = Query(default=None, alias="type"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: Literal["name", "created_at", "updated_at"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return zones.list_zones(
        db, user, search, zone_type or type_filter, page, page_size, sort_by, sort_order
    )


@router.post("", response_model=HostedZoneResponse, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(
    data: HostedZoneCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> HostedZoneResponse:
    zone = zones.create_zone(db, user or ensure_demo_user(db), data)
    response.headers["Location"] = f"/api/v1/hosted-zones/{zone.zone_id}"
    return zone


@router.get("/{zone_id}", response_model=HostedZoneResponse)
def get_hosted_zone(
    zone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> HostedZoneResponse:
    return zones.get_owned_zone(db, user, zone_id)


@router.put("/{zone_id}", response_model=HostedZoneResponse)
def update_hosted_zone(
    zone_id: str,
    data: HostedZoneUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostedZoneResponse:
    return zones.update_zone(db, zones.get_owned_zone(db, user, zone_id), data)


@router.delete("/{zone_id}", status_code=204)
def delete_hosted_zone(
    zone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    zones.delete_zone(db, zones.get_owned_zone(db, user, zone_id))
