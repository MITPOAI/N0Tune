"""Integration tests for the LangChain bindings.

We use ``httpx.MockTransport`` to stub backend responses — the goal is to
verify the LangChain shapes, not to retest the N0Tune SDK or API.
"""

from __future__ import annotations

import json as _json
from typing import Any

import httpx
import pytest
from langchain_core.documents import Document
from n0tune import N0TuneClient

from n0tune_langchain import N0TuneMemoryStore, N0TuneRetriever


def _now_iso() -> str:
    return "2026-05-16T12:00:00+00:00"


def _make_client(handler) -> N0TuneClient:
    transport = httpx.MockTransport(handler)
    return N0TuneClient(base_url="http://n0tune.test", api_key="lc", transport=transport)


def _preview_response() -> dict[str, Any]:
    return {
        "compiled_context": "compiled",
        "selected_memories": [
            {
                "id": "mem_1",
                "app_id": "demo",
                "user_id": "user_1",
                "type": "preference",
                "text": "User likes concise answers.",
                "confidence": 0.9,
                "source_message_id": None,
                "expires_at": None,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "deleted_at": None,
                "similarity": 0.72,
            }
        ],
        "selected_chunks": [
            {
                "id": "chk_1",
                "document_id": "doc_1",
                "chunk_index": 0,
                "text": "Doc chunk text.",
                "metadata_json": {},
                "injection_risk_score": 0.1,
                "injection_risk_reasons_json": [],
                "similarity": 0.66,
            }
        ],
        "style_profile": {},
        "cache_hit": False,
        "prompt_tokens_estimated": 50,
        "tokens_saved_estimated": 200,
        "warnings": [],
        "context_trace": {"why_selected": [], "excluded": []},
    }


def test_retriever_returns_memories_and_chunks_as_documents():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_preview_response())

    client = _make_client(handler)
    retriever = N0TuneRetriever(client=client, user_id="user_1")
    docs = retriever.invoke("Explain RAG.")

    assert isinstance(docs, list)
    assert all(isinstance(doc, Document) for doc in docs)
    assert len(docs) == 2

    memory_doc = docs[0]
    chunk_doc = docs[1]
    assert memory_doc.page_content == "User likes concise answers."
    assert memory_doc.metadata == {
        "kind": "memory",
        "memory_id": "mem_1",
        "memory_type": "preference",
        "confidence": 0.9,
        "similarity": 0.72,
    }
    assert chunk_doc.page_content == "Doc chunk text."
    assert chunk_doc.metadata["kind"] == "chunk"
    assert chunk_doc.metadata["chunk_id"] == "chk_1"
    assert chunk_doc.metadata["document_id"] == "doc_1"

    assert len(captured) == 1
    sent = captured[0]
    assert sent.method == "POST"
    assert sent.url.path == "/v1/context/preview"
    body = _json.loads(sent.content)
    assert body["message"] == "Explain RAG."
    assert body["user_id"] == "user_1"


def test_memory_store_save_search_and_forget():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "POST" and request.url.path == "/v1/memories":
            return httpx.Response(
                201,
                json={
                    "id": "mem_new",
                    "app_id": "demo",
                    "user_id": "user_1",
                    "type": "preference",
                    "text": "User likes diagrams.",
                    "confidence": 0.8,
                    "source_message_id": None,
                    "expires_at": None,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "deleted_at": None,
                    "similarity": None,
                },
            )
        if request.method == "GET" and request.url.path == "/v1/memories":
            return httpx.Response(200, json=[])
        if request.method == "DELETE" and request.url.path == "/v1/memories/mem_new":
            return httpx.Response(200, json={"id": "mem_new", "deleted": True, "hard_deleted": False})
        return httpx.Response(404, json={"detail": "unmocked"})

    client = _make_client(handler)
    store = N0TuneMemoryStore(client=client, user_id="user_1")
    created = store.save("User likes diagrams.", type="preference")
    assert created["id"] == "mem_new"

    listed = store.search("diagrams", limit=5)
    assert listed == []

    deleted = store.forget("mem_new")
    assert deleted["deleted"] is True

    assert [(r.method, r.url.path) for r in seen] == [
        ("POST", "/v1/memories"),
        ("GET", "/v1/memories"),
        ("DELETE", "/v1/memories/mem_new"),
    ]


def test_retriever_metadata_marks_high_risk_chunks_with_their_score():
    risky_response = _preview_response()
    risky_response["selected_chunks"][0]["injection_risk_score"] = 0.55

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=risky_response)

    client = _make_client(handler)
    retriever = N0TuneRetriever(client=client, user_id="user_1")
    docs = retriever.invoke("Risky probe.")
    risk_metadata = [doc.metadata for doc in docs if doc.metadata["kind"] == "chunk"]
    assert risk_metadata == [
        {
            "kind": "chunk",
            "chunk_id": "chk_1",
            "document_id": "doc_1",
            "chunk_index": 0,
            "injection_risk_score": 0.55,
            "similarity": 0.66,
        }
    ]


@pytest.mark.parametrize("kind", ["memory", "chunk"])
def test_retriever_returns_no_documents_when_preview_is_empty(kind: str):
    empty = _preview_response()
    empty["selected_memories"] = []
    empty["selected_chunks"] = []

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=empty)

    client = _make_client(handler)
    retriever = N0TuneRetriever(client=client, user_id="user_1")
    docs = retriever.invoke("anything")
    assert [doc for doc in docs if doc.metadata.get("kind") == kind] == []
