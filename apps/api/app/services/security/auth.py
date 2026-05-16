from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import App, User


def hash_api_key(api_key: str) -> str:
    return sha256(f"n0tune:v1:{api_key}".encode()).hexdigest()


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token.strip()


def ensure_app(session: Session, app_id: str, name: str | None = None) -> App:
    app = session.get(App, app_id)
    if app is not None:
        return app

    settings = get_settings()
    api_key_hash = hash_api_key(settings.app_api_key) if settings.app_api_key else None
    app = App(id=app_id, name=name or app_id, api_key_hash=api_key_hash)
    session.add(app)
    session.flush()
    return app


def ensure_user(session: Session, app_id: str, user_id: str) -> User:
    ensure_app(session, app_id)
    existing = session.scalar(
        select(User).where(User.app_id == app_id, User.external_user_id == user_id)
    )
    if existing is not None:
        return existing

    user = User(app_id=app_id, external_user_id=user_id)
    session.add(user)
    session.flush()
    return user


def authorize_app(
    session: Session,
    app_id: str,
    api_key: str | None = None,
    authorization: str | None = None,
) -> None:
    settings = get_settings()
    token = api_key or extract_bearer_token(authorization)

    app = ensure_app(session, app_id)
    should_require = settings.require_api_key or token is not None
    if not should_require:
        return

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing N0Tune API key.",
        )

    if app.api_key_hash is None or hash_api_key(token) != app.api_key_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid N0Tune API key for app.",
        )
