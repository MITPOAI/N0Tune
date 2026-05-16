from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import AuditLog
from app.schemas.api import AuditLogResponse
from app.services.security.auth import authorize_app
from app.services.security.permissions import Permission, require_permission

router = APIRouter(prefix="/v1/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    app_id: str = Query(default="demo"),
    resource_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[AuditLogResponse]:
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    require_permission(actor_role, Permission.VIEW_AUDIT_LOGS)

    query = select(AuditLog).where(AuditLog.app_id == app_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if action:
        query = query.where(AuditLog.action == action)
    query = query.order_by(AuditLog.created_at.desc()).limit(limit)

    rows = list(session.scalars(query))
    return [AuditLogResponse.model_validate(row) for row in rows]
