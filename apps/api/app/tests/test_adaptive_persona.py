"""Tests for the deterministic /v1/users/{id}/style/adapt endpoint.

The adapt endpoint walks the user's recent preference/fact memories and
proposes tone/depth/format tweaks via keyword voting — no LLM call.
Tests verify:

  * No memories → no suggestions, zero noise.
  * Memories agree on a single tone → suggestion fires with rationale.
  * Memories already match the current style → no suggestion (we never
    suggest a no-op).
  * Weak majority → no suggestion (don't flip on a single keyword hit).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

OWNER_AUTH = {"Authorization": "Bearer replace-with-local-development-key"}


def _add_memory(client: TestClient, user_id: str, text: str, type_: str = "preference") -> None:
    response = client.post(
        "/v1/memories",
        json={
            "app_id": "demo",
            "user_id": user_id,
            "type": type_,
            "text": text,
            "confidence": 0.9,
        },
    )
    assert response.status_code == 201, response.text


def test_adapt_with_no_memories_returns_empty(client: TestClient) -> None:
    response = client.post(
        "/v1/users/empty-user/style/adapt?app_id=demo",
        headers=OWNER_AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["inspected_memories"] == 0
    assert body["suggestions"] == []


def test_adapt_suggests_terse_when_memories_agree(client: TestClient) -> None:
    user = "adapter-tone-user"
    _add_memory(client, user, "User prefers terse code-first answers.")
    _add_memory(client, user, "User likes concise responses with no preamble.")
    _add_memory(client, user, "User wants short, brief replies.")

    response = client.post(
        f"/v1/users/{user}/style/adapt?app_id=demo",
        headers=OWNER_AUTH,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["inspected_memories"] >= 3
    tone_suggestion = next(
        (s for s in body["suggestions"] if s["field"] == "tone"), None
    )
    assert tone_suggestion is not None
    assert tone_suggestion["suggested"] == "terse"
    assert tone_suggestion["confidence"] > 0.5
    assert "terse" in tone_suggestion["rationale"]


def test_adapt_skips_when_current_already_matches(client: TestClient) -> None:
    user = "adapter-match-user"
    # Pre-set the style profile to match what memories will suggest.
    client.patch(
        f"/v1/users/{user}/style",
        json={"app_id": "demo", "profile_json": {"tone": "terse"}},
    )
    _add_memory(client, user, "User prefers terse and concise answers.")
    _add_memory(client, user, "User likes short replies.")

    response = client.post(
        f"/v1/users/{user}/style/adapt?app_id=demo",
        headers=OWNER_AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    tone_suggestion = next(
        (s for s in body["suggestions"] if s["field"] == "tone"), None
    )
    assert tone_suggestion is None, "Should not suggest the same value the profile already has"


def test_adapt_skips_on_weak_majority(client: TestClient) -> None:
    user = "adapter-weak-user"
    # Only one signal — not enough for a suggestion (we require ≥2 votes).
    _add_memory(client, user, "User likes friendly answers.")
    _add_memory(client, user, "User indexes Python files weekly.")
    _add_memory(client, user, "User runs on macOS.")

    response = client.post(
        f"/v1/users/{user}/style/adapt?app_id=demo",
        headers=OWNER_AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    # No suggestion because only one tone keyword hit.
    assert all(s["field"] != "tone" for s in body["suggestions"])
