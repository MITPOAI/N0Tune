"""Audit log helpers.

``record_audit`` inserts an ``AuditLog`` row. It is intentionally a thin
wrapper rather than middleware so call sites can name the action and the
resource explicitly; routes that mutate data should call it directly.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import AuditLog


def record_audit(
    session: Session,
    *,
    app_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    actor_user_id: str | None = None,
    actor_role: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """Insert an audit-log row. The caller still owns the surrounding commit."""
    entry = AuditLog(
        app_id=app_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        metadata_json=metadata or {},
    )
    session.add(entry)
    session.flush()
    return entry
