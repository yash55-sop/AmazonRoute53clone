from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_db
from app.db.base import Base
from app.main import app
from app.models import DNSRecord, HostedZone, User
from app.services.auth import hash_password, verify_password


@pytest.fixture
def db_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(
        engine,
        "connect",
        lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(User(username="admin", password_hash=hash_password("admin123")))
        db.commit()
    yield factory
    engine.dispose()


@pytest.fixture
def client(db_factory) -> Iterator[TestClient]:
    def override_db():
        with db_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    # Avoid entering the application lifespan, which correctly targets the configured database.
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def login(client: TestClient) -> None:
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    assert response.cookies.get("route53_session")


def test_database_initialization_and_user_password(db_factory):
    with db_factory() as db:
        assert set(Base.metadata.tables) == {"users", "sessions", "hosted_zones", "dns_records"}
        user = db.scalar(select(User).where(User.username == "admin"))
        assert user is not None
        assert user.password_hash != "admin123"
        assert verify_password("admin123", user.password_hash)


def test_relationships_and_database_cascade(db_factory):
    with db_factory() as db:
        user = db.scalar(select(User).where(User.username == "admin"))
        zone = HostedZone(zone_id="ZTESTCASCADE1", name="example.com", user=user)
        zone.records.append(
            DNSRecord(
                record_id="RTESTCASCADE1",
                name="www.example.com",
                type="A",
                value="192.0.2.1",
                ttl=60,
            )
        )
        db.add(zone)
        db.commit()
        assert user.hosted_zones[0].records[0].name == "www.example.com"
        db.delete(zone)
        db.commit()
        assert db.scalar(select(func.count()).select_from(DNSRecord)) == 0


def test_authentication_lifecycle(client: TestClient):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": "admin", "password": "wrong"}
        ).status_code
        == 401
    )
    login(client)
    assert client.get("/api/v1/auth/me").json()["username"] == "admin"
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_create_hosted_zone_without_authentication(client: TestClient, db_factory):
    created = client.post(
        "/api/v1/hosted-zones",
        json={"name": "anonymous.example", "description": "Created without login"},
    )

    assert created.status_code == 201
    assert created.json()["name"] == "anonymous.example"
    assert client.get("/api/v1/hosted-zones").status_code == 401
    with db_factory() as db:
        zone = db.scalar(select(HostedZone).where(HostedZone.name == "anonymous.example"))
        assert zone is not None
        assert zone.user.username == "admin"


def test_hosted_zone_and_record_crud(client: TestClient):
    login(client)
    created = client.post(
        "/api/v1/hosted-zones",
        json={"name": "Example.COM.", "description": "Demo"},
    )
    assert created.status_code == 201
    zone = created.json()
    assert zone["name"] == "example.com"
    assert zone["zone_id"].startswith("Z")

    records = client.get(f"/api/v1/hosted-zones/{zone['zone_id']}/records").json()
    assert records["total"] == 2
    assert {item["type"] for item in records["items"]} == {"NS", "SOA"}
    assert all(item["is_system"] for item in records["items"])
    for default_record in records["items"]:
        assert (
            client.delete(
                f"/api/v1/hosted-zones/{zone['zone_id']}/records/{default_record['record_id']}"
            ).status_code
            == 409
        )
    assert client.get(f"/api/v1/hosted-zones/{zone['zone_id']}/records").json()["total"] == 2

    record_response = client.post(
        f"/api/v1/hosted-zones/{zone['zone_id']}/records",
        json={"name": "www", "type": "A", "value": "192.0.2.10", "ttl": 60},
    )
    assert record_response.status_code == 201
    record = record_response.json()
    assert record["name"] == "www.example.com"
    assert record["is_system"] is False
    assert (
        client.get(
            f"/api/v1/hosted-zones/{zone['zone_id']}/records?record_type=A&search=www"
        ).json()["total"]
        == 1
    )
    updated = client.put(
        f"/api/v1/hosted-zones/{zone['zone_id']}/records/{record['record_id']}",
        json={"ttl": 120},
    )
    assert updated.status_code == 200
    assert updated.json()["ttl"] == 120
    assert (
        client.delete(
            f"/api/v1/hosted-zones/{zone['zone_id']}/records/{record['record_id']}"
        ).status_code
        == 204
    )

    user_ns = client.post(
        f"/api/v1/hosted-zones/{zone['zone_id']}/records",
        json={
            "name": "delegated",
            "type": "NS",
            "value": "ns1.example.net.",
            "ttl": 300,
        },
    )
    assert user_ns.status_code == 201
    assert user_ns.json()["is_system"] is False
    assert (
        client.delete(
            f"/api/v1/hosted-zones/{zone['zone_id']}/records/{user_ns.json()['record_id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/hosted-zones/{zone['zone_id']}").status_code == 204


def test_zone_search_pagination_duplicate_and_validation(client: TestClient):
    login(client)
    for name, zone_type in (("alpha.example", "PUBLIC"), ("beta.example", "PRIVATE")):
        assert (
            client.post(
                "/api/v1/hosted-zones", json={"name": name, "zone_type": zone_type}
            ).status_code
            == 201
        )
    page = client.get("/api/v1/hosted-zones?search=alpha&type=PUBLIC&page=1&page_size=1").json()
    assert page["total"] == page["pages"] == 1
    assert client.post("/api/v1/hosted-zones", json={"name": "ALPHA.EXAMPLE."}).status_code == 409
    assert client.post("/api/v1/hosted-zones", json={"name": "not a domain"}).status_code == 422


def test_ownership_isolation(client: TestClient, db_factory):
    login(client)
    zone_id = client.post("/api/v1/hosted-zones", json={"name": "private.example"}).json()[
        "zone_id"
    ]
    record_id = client.post(
        f"/api/v1/hosted-zones/{zone_id}/records",
        json={"name": "www", "type": "A", "value": "192.0.2.10", "ttl": 300},
    ).json()["record_id"]
    with db_factory() as db:
        db.add(User(username="other", password_hash=hash_password("other-password")))
        db.commit()
    other = TestClient(app)
    try:
        assert (
            other.post(
                "/api/v1/auth/login", json={"username": "other", "password": "other-password"}
            ).status_code
            == 200
        )
        assert other.get(f"/api/v1/hosted-zones/{zone_id}").status_code == 404
        record_url = f"/api/v1/hosted-zones/{zone_id}/records/{record_id}"
        assert other.get(record_url).status_code == 404
        assert other.put(record_url, json={"value": "192.0.2.20"}).status_code == 404
        assert other.delete(record_url).status_code == 404
        assert client.get(record_url).json()["value"] == "192.0.2.10"
    finally:
        other.close()


def test_record_update_delete_persistence_and_failures(client: TestClient, db_factory):
    login(client)
    zone_id = client.post("/api/v1/hosted-zones", json={"name": "records.example"}).json()[
        "zone_id"
    ]
    collection_url = f"/api/v1/hosted-zones/{zone_id}/records"

    created = client.post(
        collection_url,
        json={
            "name": "www",
            "type": "A",
            "value": "192.0.2.10",
            "ttl": 300,
            "routing_policy": "SIMPLE",
            "is_alias": False,
        },
    )
    assert created.status_code == 201
    record_id = created.json()["record_id"]
    record_url = f"{collection_url}/{record_id}"

    updated = client.put(
        record_url,
        json={
            "name": "api",
            "type": "A",
            "value": "192.0.2.20",
            "ttl": 600,
            "routing_policy": "SIMPLE",
            "is_alias": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "api.records.example"
    assert updated.json()["value"] == "192.0.2.20"
    assert updated.json()["ttl"] == 600
    assert client.get(record_url).json()["value"] == "192.0.2.20"
    with db_factory() as db:
        persisted = db.scalar(select(DNSRecord).where(DNSRecord.record_id == record_id))
        assert persisted is not None
        assert persisted.value == "192.0.2.20"
        assert persisted.ttl == 600

    cname = client.post(
        collection_url,
        json={
            "name": "docs",
            "type": "CNAME",
            "value": "target.example.net",
            "ttl": 300,
        },
    )
    assert cname.status_code == 201
    cname_url = f"{collection_url}/{cname.json()['record_id']}"
    assert client.put(cname_url, json={"value": "updated.example.net"}).status_code == 200
    assert client.get(cname_url).json()["value"] == "updated.example.net"

    assert client.put(record_url, json={"value": "not-an-ip"}).status_code == 422
    assert client.get(record_url).json()["value"] == "192.0.2.20"
    assert client.get(f"{collection_url}/RDOESNOTEXIST").status_code == 404
    assert client.put(f"{collection_url}/RDOESNOTEXIST", json={"ttl": 60}).status_code == 404
    assert client.delete(f"{collection_url}/RDOESNOTEXIST").status_code == 404
    assert client.get("/api/v1/hosted-zones/ZDOESNOTEXIST/records").status_code == 404
    assert (
        client.delete(f"/api/v1/hosted-zones/ZDOESNOTEXIST/records/{record_id}").status_code == 404
    )

    assert client.delete(record_url).status_code == 204
    assert client.get(record_url).status_code == 404
    assert all(
        item["record_id"] != record_id for item in client.get(collection_url).json()["items"]
    )
    with db_factory() as db:
        assert db.scalar(select(DNSRecord).where(DNSRecord.record_id == record_id)) is None

    assert client.delete(cname_url).status_code == 204
    assert client.get(cname_url).status_code == 404

    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get(collection_url).status_code == 401
    assert client.put(record_url, json={"ttl": 60}).status_code == 401
    assert client.delete(record_url).status_code == 401


def test_bind_import_export_bulk_delete_and_rollback(client: TestClient):
    login(client)
    zone_id = client.post("/api/v1/hosted-zones", json={"name": "import.example"}).json()["zone_id"]
    content = (
        "import.example. 300 IN A 192.0.2.20\nmail.import.example. 600 IN MX 10 mx.import.example."
    )
    imported = client.post(
        f"/api/v1/hosted-zones/{zone_id}/records/import", json={"content": content}
    )
    assert imported.status_code == 201
    assert imported.json() == {"imported": 2}
    exported = client.get(f"/api/v1/hosted-zones/{zone_id}/records/export?format=bind")
    assert exported.status_code == 200
    assert "192.0.2.20" in exported.text
    assert "10 mx.import.example." in exported.text
    exported_json = client.get(f"/api/v1/hosted-zones/{zone_id}/records/export?format=json")
    assert exported_json.status_code == 200
    assert any(record["type"] == "MX" for record in exported_json.json())

    before = client.get(f"/api/v1/hosted-zones/{zone_id}/records").json()["total"]
    invalid = client.post(
        f"/api/v1/hosted-zones/{zone_id}/records/import",
        json={"content": "ok.import.example. 60 IN A 192.0.2.21\nbroken line"},
    )
    assert invalid.status_code == 422
    assert client.get(f"/api/v1/hosted-zones/{zone_id}/records").json()["total"] == before

    records = client.get(f"/api/v1/hosted-zones/{zone_id}/records").json()["items"]
    bulk = client.post(
        f"/api/v1/hosted-zones/{zone_id}/records/bulk-delete",
        json={"ids": [record["record_id"] for record in records]},
    )
    assert bulk.status_code == 200
    assert bulk.json()["deleted"] == 2
    assert len(bulk.json()["skipped"]) == 2
