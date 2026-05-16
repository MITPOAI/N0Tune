"""Integration tests for the LlamaIndex bindings.

We stub the N0Tune HTTP API with ``httpx.MockTransport`` and verify the
LlamaIndex node shapes the retriever returns.
"""

from __future__ import annotations

import json as _json
from typing import Any

import httpx
import pytest
from llama_index.core.schema import NodeWithScore, QueryBundle
from n0tune import N0TuneClient

from n0tune_llamaindex import N0TuneMemoryStore, N0TuneRetriever


def _now_iso() -> str:
    return "2026-05-16T12:00:00+00:00"


def _make_client(handler) -> N0TuneClient:
    transport = httpx.MockTransport(handler)
    return N0TuneClient(base_url="http://n0tune.test", api_key="li", transport=transport)


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
                "similarity": 0.81,
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
                "similarity": 0.62,
            }
        ],
        "style_profile": {},
        "cache_hit": False,
        "prompt_tokens_estimated": 50,
        "tokens_saved_estimated": 200,
        "warnings": [],
        "context_trace": {"why_selected": [], "excluded": []},
    }


def test_retriever_returns_memories_and_chunks_as_nodes():
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_preview_response())

    client = _make_client(handler)
    retriever = N0TuneRetriever(client=client, user_id="user_1")
    nodes = retriever.retrieve(QueryBundle(query_str="Explain RAG."))

    assert isinstance(nodes, list)
    assert all(isinstance(node, NodeWithScore) for node in nodes)
    assert len(nodes) == 2

    memory_node, chunk_node = nodes
    assert memory_node.node.get_content() == "User likes concise answers."
    assert memory_node.node.metadata["kind"] == "memory"
    assert memory_node.node.metadata["memory_id"] == "mem_1"
    assert memory_node.score == pytest.approx(0.81)

    assert chunk_node.node.get_content() == "Doc chunk text."
    assert chunk_node.node.metadata["kind"] == "chunk"
    assert chunk_node.node.metadata["chunk_id"] == "chk_1"
    assert chunk_node.score == pytest.approx(0.62)

    assert len(captured) == 1
    body = _json.loads(captured[0].content)
    assert body["message"] == "Explain RAG."


def test_memory_store_round_trip():
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
                    "text": "User likes outlines.",
                    "confidence": 0.85,
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
    saved = store.save("User likes outlines.", type="preference")
    assert saved["id"] == "mem_new"
    assert store.search("outline") == []
    assert store.forget("mem_new")["deleted"] is True

    assert [(r.method, r.url.path) for r in seen] == [
        ("POST", "/v1/memories"),
        ("GET", "/v1/memories"),
        ("DELETE", "/v1/memories/mem_new"),
    ]


def test_retriever_returns_empty_when_preview_is_empty():
    empty = _preview_response()
    empty["selected_memories"] = []
    empty["selected_chunks"] = []

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=empty)

    client = _make_client(handler)
    retriever = N0TuneRetriever(client=client, user_id="user_1")
    assert retriever.retrieve(QueryBundle(query_str="anything")) == []
