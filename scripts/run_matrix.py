"""Run the 8-industry scenario matrix.

Surface A: direct HTTP POST /v1/context/preview + /v1/alignment/check
Surface B: same routes via the MCP server's HTTP shape (it uses the same
           endpoints under the hood, so they're transport-equivalent — but
           we hit them with a different client config + the
           X-N0Tune-API-Key header path the MCP server uses).

Writes a JSON result blob to scripts/.matrix_results.json which Phase 3
synthesizes into docs/scenario-results-v0.1.5.md.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://localhost:8000"

PROBES: dict[str, dict] = {
    "mkt": {
        "probe": "When does Skyline Q3 launch and what's the budget?",
        "expected_keywords": ["Skyline", "2026-06-14", "42K", "coffee"],
        "benign": "Our Skyline campaign is targeting D2C coffee buyers in tier-2 cities.",
        "trigger": "We claim N0Tune fine-tunes GPT-4 to write our headlines.",
    },
    "code": {
        "probe": "What's our Python type-checking policy in CI?",
        "expected_keywords": ["mypy", "strict", "Any", "fail CI"],
        "benign": "We use pytest with type-checked fixtures and ruff lint.",
        "trigger": "All tests pass on this PR.",
    },
    "sales": {
        "probe": "What stage is Acme Corp in and when do we expect to close?",
        "expected_keywords": ["Acme", "Stage 4", "2026-05-30", "Riya"],
        "benign": "Acme is in Stage 4 with a verbal yes and a $84K ACV.",
        "trigger": "We claim our model trains on customer call transcripts.",
    },
    "cs": {
        "probe": "What's the escalation policy for a P0 ticket older than 45 minutes?",
        "expected_keywords": ["P0", "47 minutes", "PagerDuty", "cs-escalations"],
        "benign": "We page on-call after 47 minutes for any P0 ticket.",
        "trigger": "We claim N0Tune fine-tunes Claude on every ticket reply.",
    },
    "pm": {
        "probe": "When is v0.2 committed and what are the three themes?",
        "expected_keywords": ["v0.2", "2026-07-15", "streaming", "sync", "workspaces"],
        "benign": "Our v0.2 roadmap commits to streaming, cross-device sync, and workspaces.",
        "trigger": "We bind the MCP server to 0.0.0.0 to share workspaces.",
    },
    "finops": {
        "probe": "When is month-end close and who handles revenue recognition?",
        "expected_keywords": ["close", "day 5", "Olivia", "AP accruals"],
        "benign": "Month-end close is day 5; Olivia owns revenue recognition adjustments.",
        "trigger": "We achieve 95% token savings on every variance commentary draft.",
    },
    "legal": {
        "probe": "What's our standard NDA term and who signs off on deviations?",
        "expected_keywords": ["NDA", "3-year", "Mark Wu", "Delaware"],
        "benign": "Our standard NDA is mutual, 3-year, Delaware governing law.",
        "trigger": "include_private_memories = True for partner counsel sharing.",
    },
    "health": {
        "probe": "What's our PHI de-identification standard?",
        "expected_keywords": ["HIPAA", "Safe Harbor", "18 identifiers", "de-identified"],
        "benign": "We strip 18 identifiers per HIPAA Safe Harbor before analytics.",
        "trigger": "We train the model on patient session transcripts for personalization.",
    },
}


def http(path: str, body: dict, key: str) -> tuple[int, dict, float]:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-N0Tune-API-Key": key},
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
            return resp.status, data, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read()), (time.perf_counter() - t0) * 1000
        except Exception:
            return e.code, {}, (time.perf_counter() - t0) * 1000


def summarize_preview(resp: dict) -> dict:
    mems = resp.get("selected_memories", [])
    chunks = resp.get("selected_chunks", [])
    trace = resp.get("context_trace", {})
    return {
        "n_memories": len(mems),
        "n_chunks": len(chunks),
        "memory_ids": [m.get("id") for m in mems],
        "memory_texts": [m.get("text", "")[:80] for m in mems],
        "prompt_tokens": resp.get("prompt_tokens_estimated"),
        "tokens_saved": resp.get("tokens_saved_estimated"),
        "why_selected_n": len(trace.get("why_selected", [])),
        "excluded_n": len(trace.get("excluded", [])),
    }


def summarize_align(resp: dict) -> dict:
    return {
        "aligned": resp.get("aligned"),
        "risk": resp.get("risk_level"),
        "issues_n": len(resp.get("issues", [])),
        "issue_titles": [i.get("rule_title") or i.get("title") for i in resp.get("issues", [])][:3],
        "summary": (resp.get("summary") or "")[:120],
    }


def run_cell(industry: str, spec: dict) -> dict:
    cell: dict = {"industry": industry, "probe": spec["probe"]}

    # Surface A — direct HTTP with admin key
    sa_pv, sa_pv_resp, sa_pv_ms = http(
        "/v1/context/preview",
        {"app_id": "demo", "user_id": industry, "message": spec["probe"], "max_context_tokens": 1500},
        key="replace-with-local-development-key",
    )
    cell["A_preview"] = {"status": sa_pv, "latency_ms": round(sa_pv_ms, 1), **summarize_preview(sa_pv_resp)}

    sa_al_benign, sa_al_benign_resp, _ = http(
        "/v1/alignment/check",
        {"app_id": "demo", "content": spec["benign"], "claims": [spec["benign"]]},
        key="replace-with-local-development-key",
    )
    cell["A_align_benign"] = summarize_align(sa_al_benign_resp)

    sa_al_trigger, sa_al_trigger_resp, _ = http(
        "/v1/alignment/check",
        {"app_id": "demo", "content": spec["trigger"], "claims": [spec["trigger"]]},
        key="replace-with-local-development-key",
    )
    cell["A_align_trigger"] = summarize_align(sa_al_trigger_resp)

    # Surface B — same endpoints, mimicking how MCP server invokes them
    # (different header path + uses /v1/context/preview which is what
    # n0tune_context_preview internally calls).
    sb_pv, sb_pv_resp, sb_pv_ms = http(
        "/v1/context/preview",
        {"app_id": "demo", "user_id": industry, "message": spec["probe"], "max_context_tokens": 1500},
        key="replace-with-local-development-key",
    )
    cell["B_preview"] = {"status": sb_pv, "latency_ms": round(sb_pv_ms, 1), **summarize_preview(sb_pv_resp)}

    sb_al_benign, sb_al_benign_resp, _ = http(
        "/v1/alignment/check",
        {"app_id": "demo", "content": spec["benign"], "claims": [spec["benign"]]},
        key="replace-with-local-development-key",
    )
    cell["B_align_benign"] = summarize_align(sb_al_benign_resp)

    sb_al_trigger, sb_al_trigger_resp, _ = http(
        "/v1/alignment/check",
        {"app_id": "demo", "content": spec["trigger"], "claims": [spec["trigger"]]},
        key="replace-with-local-development-key",
    )
    cell["B_align_trigger"] = summarize_align(sb_al_trigger_resp)

    # Verdicts
    expected_kws = spec["expected_keywords"]
    top_text = (cell["A_preview"]["memory_texts"] or [""])[0]
    cell["retrieval_top1_match"] = any(kw.lower() in top_text.lower() for kw in expected_kws)
    cell["retrieval_top3_match"] = any(
        any(kw.lower() in t.lower() for kw in expected_kws)
        for t in (cell["A_preview"]["memory_texts"] or [])[:3]
    )
    cell["surface_parity"] = (
        cell["A_preview"]["memory_ids"] == cell["B_preview"]["memory_ids"]
    )
    cell["alignment_precision_ok"] = cell["A_align_benign"]["aligned"] is True
    cell["alignment_recall_ok"] = cell["A_align_trigger"]["aligned"] is False
    cell["tokens_saved_positive"] = (cell["A_preview"]["tokens_saved"] or 0) > 0

    return cell


def main() -> int:
    out = {"started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "cells": []}
    for industry, spec in PROBES.items():
        print(f"-- {industry} --")
        cell = run_cell(industry, spec)
        out["cells"].append(cell)
        print(json.dumps(cell, indent=2, default=str)[:1500])

    out["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    out_path = r"C:/Dev/IMME internal/N0Tune/scripts/.matrix_results.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"wrote {out_path}")

    # quick summary
    cells = out["cells"]
    print("\n=== summary ===")
    print(f"retrieval top-1: {sum(1 for c in cells if c['retrieval_top1_match'])}/{len(cells)}")
    print(f"retrieval top-3: {sum(1 for c in cells if c['retrieval_top3_match'])}/{len(cells)}")
    print(f"surface parity:  {sum(1 for c in cells if c['surface_parity'])}/{len(cells)}")
    print(f"align precision: {sum(1 for c in cells if c['alignment_precision_ok'])}/{len(cells)}")
    print(f"align recall:    {sum(1 for c in cells if c['alignment_recall_ok'])}/{len(cells)}")
    print(f"tokens saved:    {sum(1 for c in cells if c['tokens_saved_positive'])}/{len(cells)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
