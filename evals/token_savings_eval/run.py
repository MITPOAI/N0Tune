"""Token-savings eval.

For each scenario, seed memories + documents, ask every query, and report
the compiled-prompt tokens against an honest 'stuff everything in' baseline.

The baseline is computed by the eval (not by the API) so it reflects the
real-world alternative most apps land on: a verbose system prompt, several
turns of chat history, every memory for the user, and every document chunk
in the corpus.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.services.context.embedding import estimate_tokens
from evals.harness import emit_report, fresh_test_client


NAIVE_SYSTEM_PROMPT = (
    "You are an extremely helpful assistant. Use the user's preferences "
    "and the supplied documents to give the best possible answer. Cite "
    "documents when relevant. Always include caveats. Stay polite, "
    "professional, and on-brand. Repeat any safety boundaries the user "
    "set in prior turns."
)

NAIVE_CHAT_HISTORY = "\n".join(
    [
        "user: Hi, I want to learn about retrieval-augmented generation.",
        "assistant: Sure — let me know what aspect interests you most.",
        "user: I keep hearing about RAG and want a thorough explanation.",
        "assistant: Happy to help. I'll cover retrieval, generation, and pitfalls.",
        "user: Great. Please use my preferences when you answer.",
        "assistant: Understood — I'll personalize accordingly.",
        "user: Also feel free to reference the docs I shared earlier.",
        "assistant: Will do.",
    ]
)


def _scenarios() -> list[dict[str, Any]]:
    path = Path(__file__).with_name("scenarios.json")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)["scenarios"]


def _seed(client: TestClient, scenario: dict[str, Any]) -> None:
    for memory in scenario["memories"]:
        response = client.post(
            "/v1/memories",
            json={
                "app_id": "demo",
                "user_id": memory["user_id"],
                "type": memory["type"],
                "text": memory["text"],
                "confidence": memory["confidence"],
            },
        )
        response.raise_for_status()
    for document in scenario["documents"]:
        response = client.post(
            "/v1/documents",
            json={
                "app_id": "demo",
                "title": document["title"],
                "source": "eval",
                "content": document["content"],
            },
        )
        response.raise_for_status()


def _naive_baseline_tokens(scenario: dict[str, Any], user_id: str, message: str) -> int:
    """Simulate 'stuff everything in': system + history + ALL user memories + ALL docs + message."""
    memories = "\n".join(
        memory["text"] for memory in scenario["memories"] if memory["user_id"] == user_id
    )
    docs = "\n\n".join(document["content"] for document in scenario["documents"])
    prompt = (
        f"{NAIVE_SYSTEM_PROMPT}\n\n"
        f"Recent conversation:\n{NAIVE_CHAT_HISTORY}\n\n"
        f"User preferences and memories:\n{memories}\n\n"
        f"Reference documents:\n{docs}\n\n"
        f"Current question: {message}"
    )
    return estimate_tokens(prompt)


def _run_scenario(client: TestClient, scenario: dict[str, Any]) -> dict[str, Any]:
    _seed(client, scenario)

    per_query: list[dict[str, Any]] = []
    naive_total = 0
    compiled_total = 0

    for query in scenario["queries"]:
        preview = client.post(
            "/v1/context/preview",
            json={
                "app_id": "demo",
                "user_id": query["user_id"],
                "message": query["message"],
            },
        )
        preview.raise_for_status()
        body = preview.json()
        compiled = int(body["prompt_tokens_estimated"])
        naive = _naive_baseline_tokens(scenario, query["user_id"], query["message"])
        saved = max(0, naive - compiled)

        per_query.append(
            {
                "user_id": query["user_id"],
                "message": query["message"],
                "compiled_prompt_tokens": compiled,
                "naive_prompt_tokens": naive,
                "tokens_saved": saved,
                "tokens_saved_percent": round(saved / naive * 100.0, 1) if naive else 0.0,
                "selected_memory_ids": [m["id"] for m in body["selected_memories"]],
                "selected_chunk_ids": [c["id"] for c in body["selected_chunks"]],
            }
        )
        compiled_total += compiled
        naive_total += naive

    saved_total = max(0, naive_total - compiled_total)
    savings_pct = (saved_total / naive_total * 100.0) if naive_total else 0.0

    return {
        "scenario": scenario["name"],
        "queries": per_query,
        "totals": {
            "naive_prompt_tokens": naive_total,
            "compiled_prompt_tokens": compiled_total,
            "tokens_saved": saved_total,
            "tokens_saved_percent": round(savings_pct, 1),
        },
    }


def run() -> dict[str, Any]:
    reports = []
    for scenario in _scenarios():
        with fresh_test_client() as client:
            reports.append(_run_scenario(client, scenario))
    return {"eval": "token_savings", "scenarios": reports}


if __name__ == "__main__":
    report = run()
    emit_report("token_savings_eval", report)
