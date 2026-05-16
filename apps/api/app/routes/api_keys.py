from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.api import ApiKeyCreate, ApiKeyResponse, DeleteResponse
from app.services.security.api_keys import (
    api_key_to_dict,
    create_api_key,
    list_api_keys,
    revoke_api_key,
)
from app.services.security.audit import record_audit
from app.services.security.auth import authorize_app, ensure_app
from app.services.security.permissions import Permission, Role, require_permission

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_key(
    payload: ApiKeyCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ApiKeyResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    require_permission(actor_role, Permission.MANAGE_API_KEYS)
    ensure_app(session, payload.app_id)

    row, plaintext = create_api_key(
        session,
        app_id=payload.app_id,
        name=payload.name,
        role=Role(payload.role),
        created_by_actor=actor_role,
    )
    record_audit(
        session,
        app_id=payload.app_id,
        action="api_key.create",
        resource_type="api_key",
        resource_id=row.id,
        actor_role=actor_role,
        metadata={"name": payload.name, "role": payload.role, "key_prefix": row.key_prefix},
    )
    session.commit()
    session.refresh(row)
    return ApiKeyResponse.model_validate(api_key_to_dict(row, plaintext=plaintext))


@router.get("", response_model=list[ApiKeyResponse])
async def list_keys(
    app_id: str = Query(default="demo"),
    include_revoked: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[ApiKeyResponse]:
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    require_permission(actor_role, Permission.MANAGE_API_KEYS)

    rows = list_api_keys(session, app_id=app_id, include_revoked=include_revoked)
    return [ApiKeyResponse.model_validate(api_key_to_dict(row)) for row in rows]


@router.delete("/{key_id}", response_model=DeleteResponse)
async def delete_key(
    key_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DeleteResponse:
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    require_permission(actor_role, Permission.MANAGE_API_KEYS)

    row = revoke_api_key(session, app_id=app_id, key_id=key_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")

    record_audit(
        session,
        app_id=app_id,
        action="api_key.revoke",
        resource_type="api_key",
        resource_id=key_id,
        actor_role=actor_role,
        metadata={"key_prefix": row.key_prefix},
    )
    session.commit()
    return DeleteResponse(id=key_id, deleted=True)
