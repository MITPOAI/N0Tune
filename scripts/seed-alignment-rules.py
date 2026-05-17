#!/usr/bin/env python3
"""Seed the starter Context Guard rule set.

Idempotent: each rule is keyed by ``app_id + title`` — re-running this
script does not create duplicates.

Usage:
    python scripts/seed-alignment-rules.py \
        --base-url http://localhost:8000 \
        --app-id demo \
        --api-key replace-with-local-development-key

The rules below mirror the examples in ``docs/context-guard.md`` and
the four canonical drift modes the alignment layer is built to catch:
terminology, security, benchmark inflation, and phase drift.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


STARTER_RULES: list[dict[str, object]] = [
    {
        "rule_type": "terminology",
        "title": "Do not claim N0Tune fine-tunes models",
        "description": (
            "N0Tune context-tunes models through memory and context. "
            "It does not change weights. Use 'context-tunes' or 'personalizes', "
            "never 'fine-tunes <model>'."
        ),
        "severity": "high",
        "pattern": r"fine[- ]?tunes?\s+(GPT|Claude|Gemini|Qwen|the model)",
    },
    {
        "rule_type": "terminology",
        "title": "Do not claim N0Tune trains models",
        "description": (
            "Training implies weight updates and a dataset; N0Tune does neither. "
            "Say 'personalize' or 'tailor' instead."
        ),
        "severity": "high",
        "pattern": r"\btrains?\s+(GPT|Claude|Gemini|Qwen|the model)",
    },
    {
        "rule_type": "security",
        "title": "MCP must be local-only by default",
        "description": (
            "Do not bind the MCP server to a public interface. The stdio "
            "transport is local by construction; HTTP transports must default "
            "to 127.0.0.1."
        ),
        "severity": "critical",
        "pattern": r"bind\s+0\.0\.0\.0|listen\s+0\.0\.0\.0",
    },
    {
        "rule_type": "forbidden_claim",
        "title": "Token-savings claim must match the documented benchmark",
        "description": (
            "Use the documented 17.4% figure or add a new reproducible "
            "benchmark before claiming higher savings."
        ),
        "severity": "medium",
        "metadata_json": {
            "claim_pattern": r"\b(7[5-9]|[89]\d|100)\s*%\s+token\s+savings",
            "actual": 17.4,
            "source": "docs/benchmarks.md",
        },
    },
    {
        "rule_type": "required_test",
        "title": "Tests-pass claims must include a test file",
        "description": (
            "If a response or PR description claims tests pass, the diff "
            "must contain at least one test file."
        ),
        "severity": "high",
        "metadata_json": {
            "claim_pattern": r"\b(all\s+)?tests?\s+pass\b",
            "test_glob": "**/tests/**",
        },
    },
    {
        "rule_type": "phase_scope",
        "title": "Phase CG-0 is documentation-only",
        "description": (
            "During CG-0, limit changes to docs/, README.md, and CHANGELOG.md. "
            "Engine code lands in CG-1."
        ),
        "severity": "high",
        "metadata_json": {
            "phase": "CG-0",
            "allowed_paths": ["docs/**", "README.md", "CHANGELOG.md"],
        },
    },
    {
        "rule_type": "memory_policy",
        "title": "Persona sharing must exclude private memories",
        "description": (
            "Persona exports are the public shell only — name, style, memory "
            "mode. Do not include scope='user' memories in persona payloads."
        ),
        "severity": "critical",
        "pattern": r"include_private_memories\s*[:=]\s*[Tt]rue",
    },
]


def _existing_titles(base_url: str, app_id: str) -> set[str]:
    url = f"{base_url}/v1/alignment/rules?app_id={app_id}"
    try:
        with urllib.request.urlopen(url) as resp:
            rows = json.load(resp)
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return set()
        raise
    return {row["title"] for row in rows}


def _post_rule(base_url: str, app_id: str, api_key: str, body: dict[str, object]) -> str:
    req = urllib.request.Request(
        f"{base_url}/v1/alignment/rules?app_id={app_id}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        result = json.load(resp)
    return str(result["id"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--app-id", default="demo")
    parser.add_argument("--api-key", default="replace-with-local-development-key")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    existing = _existing_titles(base, args.app_id)
    created = 0
    skipped = 0
    for rule in STARTER_RULES:
        if rule["title"] in existing:
            skipped += 1
            continue
        rid = _post_rule(base, args.app_id, args.api_key, rule)
        print(f"created {rid:36s}  {rule['rule_type']:18s} {rule['severity']:8s}  {rule['title']}")
        created += 1
    print(f"\ndone — {created} created, {skipped} already present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
