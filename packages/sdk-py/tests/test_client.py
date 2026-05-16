"""SDK tests use ``httpx.MockTransport`` to assert outbound request shapes.

We do not boot the real API here — the API has its own test suite. The SDK's
job is to translate idiomatic Python calls into the documented HTTP surface.
"""

from __future__ import annotations

import json as _json
from typing import Any

import httpx
import pytest

from n0tune import (
    ChatResponse,
    ContextPreviewResponse,
    DocumentResponse,
    MemoryResponse,
    N0TuneClient,
    N0TuneError,
    StyleResponse,
)


def _now_iso() -> str:
    return "2026-05-16T12:00:00+00:00"


def _memory_payload(memory_id: str = "mem_test", user_id: str = "user_1") -> dict[str, Any]:
    return {
        "id": memory_id,
        "app_id": "demo",
        "user_id": user_id,
        "type": "preference",
        "text": "User prefers concise answers.",
        "confidence": 0.92,
        "source_message_id": None,
        "expires_at": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "deleted_at": None,
        "similarity": None,
    }


def _style_payload() -> dict[str, Any]:
    return {
        "id": "sty_1",
        "app_id": "demo",
        "user_id": "user_1",
        "profile_json": {"tone": "direct", "depth": "medium", "format": "bullets"},
        "updated_at": _now_iso(),
    }


def _document_payload(document_id: str = "doc_1") -> dict[str, Any]:
    return {
        "id": document_id,
        "app_id": "demo",
        "title": "Architecture",
        "source": "api",
        "metadata_json": {"k": "v"},
        "content_hash": "abc",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "deleted_at": None,
        "chunks": [
            {
                "id": "chk_1",
                "document_id": document_id,
                "chunk_index": 0,
                "text": "chunk text",
                "metadata_json": {},
                "injection_risk_score": 0.0,
                "injection_risk_reasons_json": [],
                "similarity": None,
            }
        ],
    }


@pytest.fixture()
def captured() -> list[httpx.Request]:
    return []


@pytest.fixture()
def make_client(captured: list[httpx.Request]):
    def factory(handler) -> N0TuneClient:
        def wrapped(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return handler(request)

        transport = httpx.MockTransport(wrapped)
        return N0TuneClient(
            base_url="http://n0tune.test", api_key="sdk-test-key", transport=transport
        )

    return factory


def test_create_memory_sends_expected_payload(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json=_memory_payload())

    client = make_client(handler)
    memory = client.memories.create(user_id="user_1", text="User prefers concise answers.")

    assert isinstance(memory, MemoryResponse)
    assert memory.id == "mem_test"
    assert len(captured) == 1
    sent = captured[0]
    assert sent.method == "POST"
    assert sent.url.path == "/v1/memories"
    assert sent.headers["X-N0Tune-API-Key"] == "sdk-test-key"
    body = _json.loads(sent.content)
    assert body["user_id"] == "user_1"
    assert body["text"] == "User prefers concise answers."
    assert body["app_id"] == "demo"


def test_list_memories_passes_query_and_pagination(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[_memory_payload(memory_id="mem_a")])

    client = make_client(handler)
    memories = client.memories.list(user_id="user_1", query="architecture", limit=5)

    assert [m.id for m in memories] == ["mem_a"]
    sent = captured[0]
    assert sent.url.path == "/v1/memories"
    params = dict(sent.url.params)
    assert params["user_id"] == "user_1"
    assert params["q"] == "architecture"
    assert params["limit"] == "5"
    assert params["include_deleted"] == "false"


def test_delete_memory_supports_soft_and_hard(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "mem_a", "deleted": True, "hard_deleted": False})

    client = make_client(handler)
    client.memories.delete("mem_a")
    client.memories.delete("mem_a", hard=True)

    assert len(captured) == 2
    soft, hard = captured
    assert dict(soft.url.params)["hard"] == "false"
    assert dict(hard.url.params)["hard"] == "true"


def test_style_get_and_update(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_style_payload())

    client = make_client(handler)
    fetched = client.style.get(user_id="user_1")
    updated = client.style.update(
        user_id="user_1", profile_json={"tone": "direct"}, app_id="demo"
    )

    assert isinstance(fetched, StyleResponse)
    assert isinstance(updated, StyleResponse)
    assert len(captured) == 2
    get_call, patch_call = captured
    assert get_call.method == "GET"
    assert get_call.url.path == "/v1/users/user_1/style"
    assert patch_call.method == "PATCH"
    assert patch_call.url.path == "/v1/users/user_1/style"
    patch_body = _json.loads(patch_call.content)
    assert patch_body["profile_json"] == {"tone": "direct"}


def test_documents_create_and_list(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(201, json=_document_payload())
        return httpx.Response(200, json=[_document_payload(document_id="doc_2")])

    client = make_client(handler)
    created = client.documents.create(title="Architecture", content="Doc text.")
    listed = client.documents.list(query="architecture")

    assert isinstance(created, DocumentResponse)
    assert [doc.id for doc in listed] == ["doc_2"]
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/v1/documents"
    assert captured[1].method == "GET"
    assert dict(captured[1].url.params)["q"] == "architecture"


def test_context_preview_returns_full_response(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "compiled_context": "compiled",
                "selected_memories": [_memory_payload()],
                "selected_chunks": [],
                "style_profile": {"tone": "direct"},
                "cache_hit": False,
                "prompt_tokens_estimated": 100,
                "tokens_saved_estimated": 400,
                "warnings": [],
                "context_trace": {
                    "why_selected": [{"type": "memory", "id": "mem_test", "reason": "good fit"}],
                    "excluded": [],
                },
            },
        )

    client = make_client(handler)
    preview = client.context.preview(user_id="user_1", message="Explain RAG")

    assert isinstance(preview, ContextPreviewResponse)
    assert preview.prompt_tokens_estimated == 100
    assert preview.tokens_saved_estimated == 400
    assert preview.context_trace.why_selected[0].id == "mem_test"
    body = _json.loads(captured[0].content)
    assert body["message"] == "Explain RAG"
    assert body["max_context_tokens"] == 1200


def test_chat_request_carries_allow_cache_flag(make_client, captured):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "answer": "fine",
                "provider": "n0tune/dev",
                "context": {
                    "cache_hit": False,
                    "memories_used": [],
                    "chunks_used": [],
                    "style_profile": {},
                    "prompt_tokens_estimated": 50,
                    "tokens_saved_estimated": 200,
                    "warnings": [],
                },
            },
        )

    client = make_client(handler)
    response = client.chat.create(user_id="user_1", message="hi", allow_cache=False)

    assert isinstance(response, ChatResponse)
    sent_body = _json.loads(captured[0].content)
    assert sent_body["allow_cache"] is False


def test_error_response_raises_n0tune_error(make_client):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "not found"})

    client = make_client(handler)
    with pytest.raises(N0TuneError) as excinfo:
        client.memories.delete("does-not-exist")
    assert excinfo.value.status_code == 404
    assert excinfo.value.body == {"detail": "not found"}


def test_client_supports_context_manager(make_client):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "ok"})

    with make_client(handler) as client:
        result = client.health()
        assert result == {"status": "ok"}
