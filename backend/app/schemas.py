from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ZoneType = Literal["PUBLIC", "PRIVATE"]
RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserResponse(ORMModel):
    id: int
    username: str
    created_at: datetime


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class HostedZoneBase(BaseModel):
    name: str = Field(min_length=1, max_length=253)
    description: str | None = Field(default=None, max_length=1000)
    zone_type: ZoneType = "PUBLIC"

    @field_validator("zone_type", mode="before")
    @classmethod
    def uppercase_zone_type(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


class HostedZoneCreate(HostedZoneBase):
    pass


class HostedZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=253)
    description: str | None = Field(default=None, max_length=1000)
    zone_type: ZoneType | None = None

    @field_validator("zone_type", mode="before")
    @classmethod
    def uppercase_zone_type(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


class HostedZoneResponse(ORMModel):
    zone_id: str
    name: str
    description: str | None
    zone_type: ZoneType
    created_at: datetime
    updated_at: datetime
    record_count: int = 0


class DNSRecordBase(BaseModel):
    name: str = Field(min_length=1, max_length=253)
    type: RecordType
    value: str = Field(min_length=1, max_length=4096)
    ttl: int = Field(default=300, gt=0)
    routing_policy: Literal["SIMPLE"] = "SIMPLE"
    is_alias: bool = False

    @field_validator("type", "routing_policy", mode="before")
    @classmethod
    def uppercase_enum(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


class DNSRecordCreate(DNSRecordBase):
    pass


class DNSRecordUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=253)
    type: RecordType | None = None
    value: str | None = Field(default=None, min_length=1, max_length=4096)
    ttl: int | None = Field(default=None, gt=0)
    routing_policy: Literal["SIMPLE"] | None = None
    is_alias: bool | None = None

    @field_validator("type", "routing_policy", mode="before")
    @classmethod
    def uppercase_enum(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


class DNSRecordResponse(ORMModel):
    record_id: str
    name: str
    type: RecordType
    value: str
    ttl: int
    routing_policy: Literal["SIMPLE"]
    is_alias: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime


class HostedZonePage(BaseModel):
    items: list[HostedZoneResponse]
    page: int
    page_size: int
    total: int
    pages: int


class DNSRecordPage(BaseModel):
    items: list[DNSRecordResponse]
    page: int
    page_size: int
    total: int
    pages: int


class BulkDeleteRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)


class BulkDeleteResponse(BaseModel):
    deleted: int
    skipped: list[str] = Field(default_factory=list)


class ZoneImportRequest(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)


class ZoneImportResponse(BaseModel):
    imported: int
