"""Tests for Phase 9 + 10: memory state, decay, confirm/export, scope isolation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.models.entities import Memory
from app.services.memory.lifecycle import (
    MemoryState,
    decay_factor,
    effective_confidence,
    is_retrievable,
)

UTC = timezone.utc


def _legacy_owner_headers() -> dict[str, str]:
    return {"Authorization": "Bearer replace-with-local-development-key"}


# ---------------------------------------------------------------------------
# Lifecycle helpers (unit)
# ---------------------------------------------------------------------------


def _make_memory(**overrides: object) -> Memory:
    defaults: dict[str, object] = {
        "id": "mem_test",
        "app_id": "demo",
        "user_id": "u",
        "type": "fact",
        "text": "x",
        "confidence": 0.8,
        "state": MemoryState.ACTIVE.value,
        "scope": "user",
        "version": 1,
        "updated_at": datetime.now(UTC) - timedelta(days=10),
        "created_at": datetime.now(UTC) - timedelta(days=10),
    }
    defaults.update(overrides)
    return Memory(**defaults)


def test_is_retrievable_excludes_deleted_and_deprecated() -> None:
    deleted = _make_memory(deleted_at=datetime.now(UTC))
    assert not is_retrievable(deleted)

    deprecated = _make_memory(state=MemoryState.DEPRECATED.value)
    assert not is_retrievable(deprecated)

    expired = _make_memory(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    assert not is_retrievable(expired)

    active = _make_memory()
    assert is_retrievable(active)


def test_decay_factor_drops_with_age_and_floors_at_zero() -> None:
    young = _make_memory(updated_at=datetime.now(UTC))
    old = _make_memory(updated_at=datetime.now(UTC) - timedelta(days=180))

    young_score = decay_factor(young, half_life_days=60.0)
    old_score = decay_factor(old, half_life_days=60.0)
    assert young_score > old_score > 0


def test_confirmed_state_skips_decay_and_gets_state_boost() -> None:
    # Confirmed memories skip the decay component AND receive the
    # CONFIRMED state-weight multiplier (currently 1.10), clamped to
    # [0, 1]. Using base=1.0 keeps the math simple: 1.0 × 1.10 → clamp → 1.0.
    confirmed = _make_memory(
        state=MemoryState.CONFIRMED.value,
        confidence=1.0,
        updated_at=datetime.now(UTC) - timedelta(days=200),
    )
    # Without confirmed pinning, decay would slash this; CONFIRMED skips decay.
    assert effective_confidence(confirmed) == 1.0

    # A confirmed memory with confidence 0.8 should rank above an active
    # one with the same base because of the state-weight boost.
    confirmed_mid = _make_memory(state=MemoryState.CONFIRMED.value, confidence=0.8)
    active_mid = _make_memory(state=MemoryState.ACTIVE.value, confidence=0.8)
    assert effective_confidence(confirmed_mid) > effective_confidence(active_mid)


def test_active_memory_confidence_decays() -> None:
    fresh = _make_memory(
        state=MemoryState.ACTIVE.value,
        confidence=0.9,
        updated_at=datetime.now(UTC),
    )
    aged = _make_memory(
        state=MemoryState.ACTIVE.value,
        confidence=0.9,
        updated_at=datetime.now(UTC) - timedelta(days=120),
    )
    assert effective_confidence(fresh) > effective_confidence(aged)
    assert effective_confidence(aged) < 0.9


# ---------------------------------------------------------------------------
# Confirm + export endpoints
# ---------------------------------------------------------------------------


def test_confirm_endpoint_pins_confidence_via_state(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    created = client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": "u",
            "type": "preference",
            "text": "Pin me as confirmed.",
            "confidence": 0.7,
        },
    )
    assert created.status_code == 201
    memory_id = created.json()["id"]

    confirmed = client.post(
        f"/v1/memories/{memory_id}/confirm?app_id=demo", headers=_legacy_owner_headers()
    )
    assert confirmed.status_code == 200
    body = confirmed.json()
    assert body["state"] == "confirmed"
    assert body["last_confirmed_at"] is not None

    with session_factory() as session:
        memory = session.get(Memory, memory_id)
        assert memory is not None
        assert memory.state == "confirmed"


def test_export_endpoint_returns_soft_deleted_rows(client: TestClient) -> None:
    keep = client.post(
        "/v1/memories",
        json={"app_id": "demo", "user_id": "exp", "type": "fact", "text": "keep"},
    )
    drop = client.post(
        "/v1/memories",
        json={"app_id": "demo", "user_id": "exp", "type": "fact", "text": "drop"},
    )
    client.delete(
        f"/v1/memories/{drop.json()['id']}?app_id=demo", headers=_legacy_owner_headers()
    )

    export = client.get(
        "/v1/memories/export?app_id=demo&user_id=exp", headers=_legacy_owner_headers()
    )
    assert export.status_code == 200, export.text
    ids = {row["id"] for row in export.json()}
    assert keep.json()["id"] in ids
    assert drop.json()["id"] in ids


# ---------------------------------------------------------------------------
# Scope-aware retrieval
# ---------------------------------------------------------------------------


def test_app_scope_memory_is_visible_to_other_users_in_same_app(client: TestClient) -> None:
    shared = client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": "team_writer",
            "type": "project",
            "text": "Shared team rule: prefer ADRs for design decisions.",
            "confidence": 0.95,
            "scope": "team",
        },
    )
    assert shared.status_code == 201
    shared_id = shared.json()["id"]

    preview = client.post(
        "/v1/context/preview",
        json={
            "app_id": "demo",
            "user_id": "different_user",
            "message": "What's our standard for design decisions?",
        },
    )
    assert preview.status_code == 200
    selected_ids = [item["id"] for item in preview.json()["selected_memories"]]
    assert shared_id in selected_ids, selected_ids


def test_user_scope_memory_stays_private_across_users(client: TestClient) -> None:
    private = client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": "alice",
            "type": "preference",
            "text": "Alice likes concise answers.",
            "confidence": 0.9,
        },
    )
    assert private.status_code == 201
    private_id = private.json()["id"]

    preview = client.post(
        "/v1/context/preview",
        json={
            "app_id": "demo",
            "user_id": "bob",
            "message": "How should I answer?",
        },
    )
    assert preview.status_code == 200
    selected_ids = [item["id"] for item in preview.json()["selected_memories"]]
    assert private_id not in selected_ids


def test_context_preview_stamps_last_used_at_for_selected_memories(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    created = client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": "u_use",
            "type": "preference",
            "text": "Prefer architecture explanations with diagrams.",
            "confidence": 0.92,
        },
    )
    memory_id = created.json()["id"]

    with session_factory() as session:
        before = session.get(Memory, memory_id)
        assert before is not None
        assert before.last_used_at is None

    preview = client.post(
        "/v1/context/preview",
        json={
            "app_id": "demo",
            "user_id": "u_use",
            "message": "Architecture diagrams: tell me about them.",
        },
    )
    assert preview.status_code == 200
    assert any(item["id"] == memory_id for item in preview.json()["selected_memories"])

    with session_factory() as session:
        after = session.get(Memory, memory_id)
        assert after is not None
        assert after.last_used_at is not None
