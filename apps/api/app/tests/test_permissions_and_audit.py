"""Tests for Phase 11: API key CRUD, role enforcement, and audit logging."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.entities import ApiKey, AuditLog
from app.services.security.permissions import (
    Permission,
    Role,
    require_permission,
    role_satisfies,
)


def _legacy_owner_headers() -> dict[str, str]:
    """Headers that authenticate as the legacy single-key owner."""
    return {"Authorization": "Bearer replace-with-local-development-key"}


# ---------------------------------------------------------------------------
# Role math
# ---------------------------------------------------------------------------


def test_role_satisfies_orders_owner_above_viewer() -> None:
    assert role_satisfies(Role.OWNER, Role.VIEWER)
    assert role_satisfies(Role.ADMIN, Role.DEVELOPER)
    assert role_satisfies(Role.DEVELOPER, Role.VIEWER)
    assert not role_satisfies(Role.VIEWER, Role.DEVELOPER)
    assert not role_satisfies(Role.DEVELOPER, Role.ADMIN)


def test_role_satisfies_accepts_string_role() -> None:
    assert role_satisfies("admin", Role.DEVELOPER)
    assert not role_satisfies("viewer", Role.ADMIN)
    assert not role_satisfies(None, Role.VIEWER)
    assert not role_satisfies("not-a-role", Role.VIEWER)


def test_require_permission_raises_with_actor_role_in_detail() -> None:
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as excinfo:
        require_permission("viewer", Permission.DELETE_MEMORY)
    assert excinfo.value.status_code == 403
    detail = excinfo.value.detail
    assert isinstance(detail, dict)
    assert detail["permission"] == "memory.delete"
    assert detail["required_role"] == "admin"
    assert detail["actor_role"] == "viewer"


# ---------------------------------------------------------------------------
# API key CRUD
# ---------------------------------------------------------------------------


def test_api_key_creation_returns_plaintext_once_and_persists_hash(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    response = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "ci-developer", "role": "developer"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "ci-developer"
    assert body["role"] == "developer"
    assert body["plaintext"], "plaintext key must be returned on creation"
    assert body["plaintext"].startswith("n0tune_")
    assert body["key_prefix"] == body["plaintext"][:12]

    listed = client.get("/v1/api-keys?app_id=demo", headers=_legacy_owner_headers()).json()
    assert any(row["id"] == body["id"] and row["plaintext"] is None for row in listed)

    with session_factory() as session:
        stored = session.get(ApiKey, body["id"])
        assert stored is not None
        assert stored.key_hash != body["plaintext"]
        assert stored.key_hash != ""


def test_api_key_can_be_used_to_authenticate_subsequent_requests(client: TestClient) -> None:
    create = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "dev-key", "role": "developer"},
    )
    assert create.status_code == 201
    plaintext = create.json()["plaintext"]
    dev_headers = {"Authorization": f"Bearer {plaintext}"}

    # Developer can write a memory.
    write = client.post(
        "/v1/memories",
        headers=dev_headers,
        json={
            "app_id": "demo",
            "user_id": "user_1",
            "type": "preference",
            "text": "Issued via new API key.",
            "confidence": 0.9,
        },
    )
    assert write.status_code == 201, write.text

    # Developer cannot delete a memory (admin+).
    memory_id = write.json()["id"]
    bad_delete = client.delete(f"/v1/memories/{memory_id}?app_id=demo", headers=dev_headers)
    assert bad_delete.status_code == 403, bad_delete.text
    assert bad_delete.json()["detail"]["required_role"] == "admin"


def test_viewer_cannot_write_memory_but_can_preview_context(client: TestClient) -> None:
    create = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "viewer", "role": "viewer"},
    )
    viewer_headers = {"Authorization": f"Bearer {create.json()['plaintext']}"}

    write = client.post(
        "/v1/memories",
        headers=viewer_headers,
        json={"app_id": "demo", "user_id": "user_1", "type": "fact", "text": "blocked"},
    )
    assert write.status_code == 403

    preview = client.post(
        "/v1/context/preview",
        headers=viewer_headers,
        json={"app_id": "demo", "user_id": "user_1", "message": "hello"},
    )
    assert preview.status_code == 200


def test_revoking_an_api_key_kills_subsequent_auth(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    create = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "throwaway", "role": "developer"},
    )
    key_id = create.json()["id"]
    plaintext = create.json()["plaintext"]
    headers = {"Authorization": f"Bearer {plaintext}"}

    assert (
        client.post(
            "/v1/memories",
            headers=headers,
            json={"app_id": "demo", "user_id": "u", "type": "fact", "text": "before"},
        ).status_code
        == 201
    )

    revoke = client.delete(f"/v1/api-keys/{key_id}?app_id=demo", headers=_legacy_owner_headers())
    assert revoke.status_code == 200

    after = client.post(
        "/v1/memories",
        headers=headers,
        json={"app_id": "demo", "user_id": "u", "type": "fact", "text": "after"},
    )
    assert after.status_code == 403, after.text

    with session_factory() as session:
        stored = session.get(ApiKey, key_id)
        assert stored is not None
        assert stored.revoked_at is not None


def test_only_owner_can_manage_api_keys(client: TestClient) -> None:
    admin_create = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "admin", "role": "admin"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_create.json()['plaintext']}"}

    # Admin can read audit logs.
    audit = client.get("/v1/audit-logs?app_id=demo", headers=admin_headers)
    assert audit.status_code == 200

    # But admin cannot mint new API keys.
    forbidden = client.post(
        "/v1/api-keys",
        headers=admin_headers,
        json={"app_id": "demo", "name": "minted-by-admin", "role": "developer"},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["required_role"] == "owner"


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


def test_memory_lifecycle_writes_audit_log_entries(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    created = client.post(
        "/v1/memories",
        headers=_legacy_owner_headers(),
        json={
            "app_id": "demo",
            "user_id": "audit_user",
            "type": "preference",
            "text": "audit me",
            "confidence": 0.9,
        },
    )
    assert created.status_code == 201
    memory_id = created.json()["id"]

    client.patch(
        f"/v1/memories/{memory_id}",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "text": "audit me v2"},
    )
    client.delete(f"/v1/memories/{memory_id}?app_id=demo", headers=_legacy_owner_headers())

    with session_factory() as session:
        rows = list(
            session.scalars(
                select(AuditLog)
                .where(AuditLog.app_id == "demo", AuditLog.resource_id == memory_id)
                .order_by(AuditLog.created_at)
            )
        )
    actions = [row.action for row in rows]
    assert actions == ["memory.create", "memory.update", "memory.delete"]
    for row in rows:
        assert row.actor_role == "owner"


def test_audit_log_listing_filters_by_resource_type(client: TestClient) -> None:
    client.post(
        "/v1/memories",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "user_id": "u", "type": "fact", "text": "log target"},
    )
    client.post(
        "/v1/documents",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "title": "audit-doc", "source": "test", "content": "body"},
    )

    listing = client.get(
        "/v1/audit-logs?app_id=demo&resource_type=memory",
        headers=_legacy_owner_headers(),
    )
    assert listing.status_code == 200
    types = {row["resource_type"] for row in listing.json()}
    assert types == {"memory"}, types


def test_viewer_role_cannot_read_audit_logs(client: TestClient) -> None:
    create = client.post(
        "/v1/api-keys",
        headers=_legacy_owner_headers(),
        json={"app_id": "demo", "name": "viewer", "role": "viewer"},
    )
    viewer_headers = {"Authorization": f"Bearer {create.json()['plaintext']}"}
    forbidden = client.get("/v1/audit-logs?app_id=demo", headers=viewer_headers)
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["required_role"] == "admin"
