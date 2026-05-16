"""Tests for the continual-learning consolidation pass."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.entities import Memory
from app.services.memory.consolidation import consolidate
from app.services.memory.lifecycle import MemoryState


def _legacy_owner_headers() -> dict[str, str]:
    return {"Authorization": "Bearer replace-with-local-development-key"}


def test_consolidate_with_no_memories_is_a_noop(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as session:
        report = consolidate(session, app_id="demo", user_id="alone")
    assert report.active_before == 0
    assert report.active_after == 0
    assert report.clusters_collapsed == 0


def test_consolidate_collapses_near_duplicate_memories(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    user = "cluster_user"
    for _ in range(5):
        # Same text → identical embedding → cluster.
        response = client.post(
            "/v1/memories",
            json={
                "app_id": "demo",
                "user_id": user,
                "type": "fact",
                "text": "User prefers terse code-first answers with ASCII diagrams.",
                "confidence": 0.9,
            },
        )
        assert response.status_code == 201, response.text

    # Independent topic the consolidator should leave alone.
    client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": user,
            "type": "preference",
            "text": "User vacations in Lisbon every August.",
            "confidence": 0.7,
        },
    )

    result = client.post(
        f"/v1/memories/consolidate?app_id=demo&user_id={user}",
        headers=_legacy_owner_headers(),
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["active_before"] == 6
    assert body["clusters_collapsed"] == 1
    assert len(body["new_summary_ids"]) == 1
    # Five duplicates collapse to one summary, plus the untouched Lisbon
    # memory = 2 active rows.
    assert body["active_after"] == 2

    # The summary memory must exist and the duplicates must be deprecated
    # pointing at it.
    with session_factory() as session:
        summary_id = body["new_summary_ids"][0]
        summary = session.get(Memory, summary_id)
        assert summary is not None
        assert summary.state == MemoryState.CONFIRMED.value
        assert "Consolidated summary" in summary.text

        deprecated = list(
            session.scalars(
                select(Memory).where(
                    Memory.user_id == user,
                    Memory.state == MemoryState.DEPRECATED.value,
                )
            )
        )
        assert len(deprecated) == 5
        assert all(memory.replaced_by_memory_id == summary_id for memory in deprecated)


def test_consolidate_dry_run_does_not_mutate(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    user = "dry_run_user"
    for _ in range(3):
        client.post(
            "/v1/memories",
            json={
                "app_id": "demo",
                "user_id": user,
                "type": "style",
                "text": "User likes diagrams when explaining architecture.",
                "confidence": 0.9,
            },
        )

    response = client.post(
        f"/v1/memories/consolidate?app_id=demo&user_id={user}&dry_run=true",
        headers=_legacy_owner_headers(),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dry_run"] is True
    assert body["clusters_collapsed"] == 1
    assert body["new_summary_ids"] == []
    assert body["active_after"] == 3  # unchanged

    with session_factory() as session:
        rows = list(
            session.scalars(
                select(Memory).where(Memory.user_id == user, Memory.deleted_at.is_(None))
            )
        )
    assert len(rows) == 3
    assert all(row.state == MemoryState.ACTIVE.value for row in rows)


def test_consolidate_writes_audit_log_row(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    from app.models.entities import AuditLog

    user = "audit_consolidation_user"
    for _ in range(2):
        client.post(
            "/v1/memories",
            json={
                "app_id": "demo",
                "user_id": user,
                "type": "fact",
                "text": "Identical text to force a cluster of two.",
                "confidence": 0.95,
            },
        )

    response = client.post(
        f"/v1/memories/consolidate?app_id=demo&user_id={user}",
        headers=_legacy_owner_headers(),
    )
    assert response.status_code == 200

    with session_factory() as session:
        rows = list(
            session.scalars(
                select(AuditLog).where(
                    AuditLog.app_id == "demo",
                    AuditLog.action == "memory.consolidate",
                    AuditLog.actor_user_id == user,
                )
            )
        )
    assert len(rows) == 1
    meta = rows[0].metadata_json
    assert meta["clusters_collapsed"] == 1
    assert isinstance(meta["new_summary_ids"], list)
