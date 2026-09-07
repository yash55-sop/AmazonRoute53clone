from collections.abc import Iterator

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import User
from app.services.auth import ensure_demo_user, session_for_token


def get_db() -> Iterator[Session]:
    """Close each request's session; services own commits and transaction boundaries."""
    with SessionLocal() as session:
        yield session


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_session = session_for_token(db, request.cookies.get(settings.session_cookie_name))
    if auth_session is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return auth_session.user


def get_demo_user(db: Session = Depends(get_db)) -> User:
    """Return the shared owner used by the unauthenticated Route 53 demo."""
    return ensure_demo_user(db)
