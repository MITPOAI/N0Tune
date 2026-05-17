"""Context Guard — alignment check API.

Phase CG-2 surface. Exposes the deterministic rule engine over HTTP so:

- the dashboard "Context Guard" tab can run an alignment check from the UI;
- the ``n0tune_alignment_check`` MCP tool can ground an AI agent's plan
  before it commits to a response;
- the ``n0tune align`` CLI can pre-flight a diff before it gets pushed.

The engine itself is in :mod:`app.services.alignment.rules`. This route
is a thin wrapper that handles auth, persistence reads, and request /
response shaping.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import AlignmentRule
from app.services.alignment.rules import run_rule_engine
from app.services.security.auth import authorize_app
from app.services.security.permissions import Permission, require_permission

router = APIRouter(prefix="/v1/alignment", tags=["alignment"])


class AlignmentCheckRequest(BaseModel):
    app_id: str = Field(default="demo")
    user_id: str = Field(default="cli")
    phase: str | None = None
    content: str = ""
    claims: list[str] = Field(default_factory=list)
    changed_files: list[str] = Field(default_factory=list)
    strict: bool = False


class AlignmentRuleResponse(BaseModel):
    id: str
    rule_type: str
    title: str
    description: str
    severity: str
    pattern: str | None
    metadata_json: dict[str, object]
    active: bool


@router.post("/check")
async def alignment_check(
    payload: AlignmentCheckRequest,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Run all active rules for ``app_id`` against the proposed content."""
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    rules = list(
        session.scalars(
            select(AlignmentRule).where(
                AlignmentRule.app_id == payload.app_id,
                AlignmentRule.active.is_(True),
            )
        )
    )
    report = run_rule_engine(
        rules,
        content=payload.content,
        claims=payload.claims,
        changed_files=payload.changed_files,
        phase=payload.phase,
        strict=payload.strict,
    )
    return report.to_dict()


@router.get("/rules")
async def list_rules(
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[AlignmentRuleResponse]:
    """Public read of the active rules so agents know what they're checked against."""
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    rules = list(
        session.scalars(
            select(AlignmentRule).where(AlignmentRule.app_id == app_id).order_by(AlignmentRule.id)
        )
    )
    return [
        AlignmentRuleResponse(
            id=rule.id,
            rule_type=rule.rule_type,
            title=rule.title,
            description=rule.description,
            severity=rule.severity,
            pattern=rule.pattern,
            metadata_json=dict(rule.metadata_json or {}),
            active=rule.active,
        )
        for rule in rules
    ]


class AlignmentRuleCreate(BaseModel):
    rule_type: str
    title: str
    description: str
    severity: str = "medium"
    pattern: str | None = None
    metadata_json: dict[str, object] = Field(default_factory=dict)
    active: bool = True


@router.post("/rules")
async def upsert_rule(
    payload: AlignmentRuleCreate,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> AlignmentRuleResponse:
    """Admin-only — add a new alignment rule for ``app_id``."""
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    require_permission(actor_role, Permission.MANAGE_API_KEYS)  # owner only

    rule = AlignmentRule(
        app_id=app_id,
        rule_type=payload.rule_type,
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        pattern=payload.pattern,
        metadata_json=dict(payload.metadata_json),
        active=payload.active,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return AlignmentRuleResponse(
        id=rule.id,
        rule_type=rule.rule_type,
        title=rule.title,
        description=rule.description,
        severity=rule.severity,
        pattern=rule.pattern,
        metadata_json=dict(rule.metadata_json or {}),
        active=rule.active,
    )
