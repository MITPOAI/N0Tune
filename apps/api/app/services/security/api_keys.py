"""Per-app API key management.

The legacy single-key model (``apps.api_key_hash``) is preserved for backward
compatibility — that key validates as the ``owner`` role. New keys live in
``api_keys`` with explicit role and an optional name. Plaintext is shown to
the caller exactly once on creation; only the hash is stored.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import ApiKey
from app.services.security.auth import hash_api_key
from app.services.security.permissions import Role

UTC = timezone.utc


def generate_plaintext_key() -> str:
    """Returns a URL-safe random key prefixed with ``n0tune_`` for grepability."""
    return f"n0tune_{secrets.token_urlsafe(32)}"


def key_prefix(plaintext: str) -> str:
    """First 12 chars of the plaintext key, safe to store and show in lists."""
    return plaintext[:12]


def create_api_key(
    session: Session,
    *,
    app_id: str,
    name: str,
    role: Role,
    created_by_actor: str | None = None,
    plaintext: str | None = None,
) -> tuple[ApiKey, str]:
    """Create a new key and return ``(row, plaintext)``. Caller commits."""
    plaintext = plaintext or generate_plaintext_key()
    row = ApiKey(
        app_id=app_id,
        name=name,
        key_hash=hash_api_key(plaintext),
        key_prefix=key_prefix(plaintext),
        role=role.value,
        created_by_actor=created_by_actor,
    )
    session.add(row)
    session.flush()
    return row, plaintext


def list_api_keys(session: Session, *, app_id: str, include_revoked: bool = False) -> list[ApiKey]:
    query = select(ApiKey).where(ApiKey.app_id == app_id)
    if not include_revoked:
        query = query.where(ApiKey.revoked_at.is_(None))
    return list(session.scalars(query.order_by(ApiKey.created_at.desc())))


def revoke_api_key(session: Session, *, app_id: str, key_id: str) -> ApiKey | None:
    key = session.get(ApiKey, key_id)
    if key is None or key.app_id != app_id:
        return None
    if key.revoked_at is None:
        key.revoked_at = datetime.now(UTC)
    return key


def lookup_active_key(session: Session, *, app_id: str, plaintext: str) -> ApiKey | None:
    """Match a plaintext key against active rows for the given app."""
    digest = hash_api_key(plaintext)
    row = session.scalar(
        select(ApiKey).where(
            ApiKey.app_id == app_id,
            ApiKey.key_hash == digest,
            ApiKey.revoked_at.is_(None),
        )
    )
    if row is not None:
        row.last_used_at = datetime.now(UTC)
    return row


def api_key_to_dict(row: ApiKey, *, plaintext: str | None = None) -> dict[str, Any]:
    """Serializer for the API response. Plaintext is included only at creation."""
    return {
        "id": row.id,
        "app_id": row.app_id,
        "name": row.name,
        "role": row.role,
        "key_prefix": row.key_prefix,
        "created_at": row.created_at,
        "created_by_actor": row.created_by_actor,
        "revoked_at": row.revoked_at,
        "last_used_at": row.last_used_at,
        "plaintext": plaintext,
    }
