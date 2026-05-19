"""Phase CG-2 — /v1/alignment/check endpoint integration tests.

These tests use the FastAPI TestClient with the in-memory SQLite
session_factory the rest of the API tests share. They exercise the
HTTP shape end-to-end, including auth, persistence, and the JSON
contract of ``AlignmentReport``.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def _seed_rule(client: TestClient, **overrides: object) -> dict[str, object]:
    payload = {
        "rule_type": "terminology",
        "title": "N0Tune context-tunes; it does not fine-tune.",
        "description": "Use 'context-tunes' or 'personalizes', never 'fine-tunes <model>'.",
        "severity": "high",
        "pattern": r"fine[- ]?tunes?\s+(GPT|Claude|Gemini)",
        "active": True,
        "metadata_json": {},
    }
    payload.update(overrides)
    response = client.post(
        "/v1/alignment/rules?app_id=demo",
        json=payload,
        headers={"Authorization": "Bearer replace-with-local-development-key"},
    )
    assert response.status_code == 200, response.text
    body: dict[str, object] = response.json()
    return body


def test_check_endpoint_flags_terminology_drift(client: TestClient) -> None:
    _seed_rule(client)
    response = client.post(
        "/v1/alignment/check",
        json={
            "app_id": "demo",
            "user_id": "claude-code",
            "content": "N0Tune fine-tunes Gemini using local memory.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["aligned"] is False
    assert body["risk_level"] == "high"
    assert body["issues"][0]["type"] == "terminology_error"
    assert "fine-tunes Gemini" in body["issues"][0]["evidence"]


def test_check_endpoint_passes_when_content_is_aligned(client: TestClient) -> None:
    _seed_rule(client)
    response = client.post(
        "/v1/alignment/check",
        json={
            "app_id": "demo",
            "content": "N0Tune context-tunes Gemini using local memory.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["aligned"] is True
    assert body["issues"] == []


def test_check_endpoint_blocks_secrets_without_any_rules(client: TestClient) -> None:
    # No rules seeded — the always-on secret detector should still fire.
    response = client.post(
        "/v1/alignment/check",
        json={
            "app_id": "demo",
            "content": "remember my OPENAI_API_KEY=sk-AbCdEf0123456789012345_xyz",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["risk_level"] == "critical"
    assert any(i["type"] == "secret_storage" for i in body["issues"])


def test_list_rules_returns_seeded_rule(client: TestClient) -> None:
    seeded = _seed_rule(client)
    response = client.get("/v1/alignment/rules?app_id=demo")
    assert response.status_code == 200
    rules = response.json()
    assert any(r["id"] == seeded["id"] for r in rules)


def test_post_rule_requires_owner_role(client: TestClient) -> None:
    # No Authorization header → authorize_app returns None → require_permission
    # raises 403.
    response = client.post(
        "/v1/alignment/rules?app_id=demo",
        json={
            "rule_type": "terminology",
            "title": "test",
            "description": "test",
            "severity": "low",
            "pattern": "x",
        },
    )
    assert response.status_code == 403
