"""Tests for the Anthropic and Gemini provider router paths.

The default OpenAI-compatible path is already covered in test_hardening.py.
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient


def test_anthropic_provider_kind_calls_messages_endpoint(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("N0TUNE_PROVIDER_KIND", "anthropic")
    monkeypatch.setenv("N0TUNE_PROVIDER_NAME", "claude-test")
    monkeypatch.setenv("N0TUNE_PROVIDER_BASE_URL", "https://anthropic.test")
    monkeypatch.setenv("N0TUNE_PROVIDER_API_KEY", "ant-test-key")

    from app.config import get_settings

    get_settings.cache_clear()
    try:
        with respx.mock(assert_all_called=True, assert_all_mocked=False) as router:
            route = router.post("https://anthropic.test/v1/messages").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "id": "msg_1",
                        "type": "message",
                        "role": "assistant",
                        "model": "claude-test",
                        "content": [
                            {"type": "text", "text": "anthropic response"},
                        ],
                        "stop_reason": "end_turn",
                    },
                )
            )
            response = client.post(
                "/v1/chat",
                json={
                    "app_id": "demo",
                    "user_id": "ant_user",
                    "message": "Hello Claude",
                    "model": "claude-test",
                    "allow_cache": False,
                },
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["answer"] == "anthropic response"
        assert body["provider"] == "claude-test"

        sent = route.calls[0].request
        assert sent.headers["x-api-key"] == "ant-test-key"
        assert sent.headers["anthropic-version"]  # default version sent
        payload = json.loads(sent.content)
        assert payload["model"] == "claude-test"
        assert payload["messages"] == [{"role": "user", "content": "Hello Claude"}]
        assert payload["system"]  # compiled context is the system message
    finally:
        get_settings.cache_clear()


def test_gemini_provider_kind_calls_generate_content(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("N0TUNE_PROVIDER_KIND", "gemini")
    monkeypatch.setenv("N0TUNE_PROVIDER_NAME", "gemini-test")
    monkeypatch.setenv("N0TUNE_PROVIDER_BASE_URL", "https://gemini.test/v1beta")
    monkeypatch.setenv("N0TUNE_PROVIDER_API_KEY", "gem-test-key")

    from app.config import get_settings

    get_settings.cache_clear()
    try:
        with respx.mock(assert_all_called=True, assert_all_mocked=False) as router:
            route = router.post(
                "https://gemini.test/v1beta/models/gemini-test:generateContent"
            ).mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "candidates": [
                            {
                                "content": {
                                    "role": "model",
                                    "parts": [{"text": "gemini response"}],
                                }
                            }
                        ]
                    },
                )
            )
            response = client.post(
                "/v1/chat",
                json={
                    "app_id": "demo",
                    "user_id": "gem_user",
                    "message": "Hello Gemini",
                    "model": "gemini-test",
                    "allow_cache": False,
                },
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["answer"] == "gemini response"
        assert body["provider"] == "gemini-test"

        sent = route.calls[0].request
        # API key goes in the query string, not headers, for Gemini REST.
        assert "key=gem-test-key" in str(sent.url)
        payload = json.loads(sent.content)
        assert payload["contents"][0]["parts"][0]["text"] == "Hello Gemini"
        assert payload["systemInstruction"]["parts"]
    finally:
        get_settings.cache_clear()
