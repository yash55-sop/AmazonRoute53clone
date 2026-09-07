import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.models import Session, User

SCRYPT_N = 2**14


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=8, p=1)
    salt_text = base64.urlsafe_b64encode(salt).decode()
    digest_text = base64.urlsafe_b64encode(digest).decode()
    return f"scrypt${salt_text}${digest_text}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_text, digest_text = encoded.split("$", 2)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(digest_text)
        actual = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=8, p=1)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def ensure_demo_user(db: DBSession) -> User:
    user = db.scalar(select(User).where(User.username == "admin"))
    if user is None:
        user = User(username="admin", password_hash=hash_password("admin123"))
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def authenticate(db: DBSession, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username.strip()))
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def create_session(db: DBSession, user: User) -> tuple[Session, str]:
    # Store a digest, so a database leak does not expose a usable bearer credential.
    raw_token = secrets.token_urlsafe(32)
    token_digest = hashlib.sha256(raw_token.encode()).hexdigest()
    session = Session(
        token=token_digest,
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_lifetime_seconds),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw_token


def session_for_token(db: DBSession, raw_token: str | None) -> Session | None:
    if not raw_token:
        return None
    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    session = db.scalar(select(Session).where(Session.token == digest))
    if session is None:
        return None
    if as_utc(session.expires_at) <= datetime.now(UTC):
        db.delete(session)
        db.commit()
        return None
    return session


def revoke_session(db: DBSession, raw_token: str | None) -> None:
    if raw_token:
        digest = hashlib.sha256(raw_token.encode()).hexdigest()
        db.execute(delete(Session).where(Session.token == digest))
        db.commit()
