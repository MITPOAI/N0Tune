from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.api import StylePatch, StyleResponse
from app.services.context.compiler import get_style_profile
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1/users", tags=["style"])
UTC = timezone.utc


@router.get("/{user_id}/style", response_model=StyleResponse)
async def get_style(
    user_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> StyleResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    profile = get_style_profile(session, app_id, user_id)
    session.commit()
    session.refresh(profile)
    return StyleResponse.model_validate(profile)


@router.patch("/{user_id}/style", response_model=StyleResponse)
async def patch_style(
    user_id: str,
    payload: StylePatch,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> StyleResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    profile = get_style_profile(session, payload.app_id, user_id)
    profile.profile_json = _deep_merge(dict(profile.profile_json), payload.profile_json)
    profile.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(profile)
    return StyleResponse.model_validate(profile)


def _deep_merge(base: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    for key, value in update.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            base[key] = _deep_merge(dict(base[key]), value)
        else:
            base[key] = value
    return base
