from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.models import User
from app.schemas import LoginRequest, UserResponse
from app.services.auth import as_utc, authenticate, create_session, revoke_session

router = APIRouter(prefix="/auth", tags=["authentication"])


def session_cookie_samesite() -> Literal["lax", "none"]:
    return "none" if settings.session_cookie_secure else "lax"


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = authenticate(db, data.username, data.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    session, raw_token = create_session(db, user)
    response.set_cookie(
        settings.session_cookie_name,
        raw_token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=session_cookie_samesite(),
        max_age=settings.session_lifetime_seconds,
        expires=as_utc(session.expires_at),
        path="/",
    )
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    revoke_session(db, request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(
        settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=session_cookie_samesite(),
        path="/",
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user
