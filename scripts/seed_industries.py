"""Seed 8 industries with 3 memories each.

Per-industry shape (matches the plan's "tactical fact / preference /
constraint" trio). Each industry uses a dedicated user_id namespace so
isolation tests are meaningful. A 9th namespace ``audit_seed`` is created
but left empty — it's the cross-contamination canary.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"

INDUSTRIES: dict[str, list[dict[str, str]]] = {
    "mkt": [
        {"type": "fact", "text": "Our flagship campaign 'Skyline Q3' targets D2C coffee buyers in tier-2 US cities, budget $42K, launch date 2026-06-14."},
        {"type": "preference", "text": "I prefer punchy 6-word headlines and emoji-free email subject lines. No clickbait, ever."},
        {"type": "fact", "text": "Brand voice constraint: warm, never academic. Always cite real customer quotes when making claims."},
    ],
    "code": [
        {"type": "fact", "text": "Our repo uses Python 3.12 with mypy strict, ruff lint, and pytest. Type errors must fail CI. We never use Any."},
        {"type": "preference", "text": "I prefer pure functions over classes when state isn't shared. Test files live next to source as test_*.py."},
        {"type": "fact", "text": "Database migrations are squashed quarterly. Never edit a migration after it has shipped to staging."},
    ],
    "sales": [
        {"type": "fact", "text": "Acme Corp is in Stage 4 (Verbal Yes), ACV $84K, close target 2026-05-30, primary champion is Riya Patel (VP Eng)."},
        {"type": "preference", "text": "I follow up via short Loom videos, never long email walls. Always include one specific question."},
        {"type": "fact", "text": "Our discount ceiling without manager approval is 12%. Multi-year commit unlocks an extra 5%."},
    ],
    "cs": [
        {"type": "fact", "text": "Tier-1 escalation policy: any P0 ticket older than 47 minutes auto-pages the on-call engineer via PagerDuty service 'cs-escalations'."},
        {"type": "preference", "text": "I write replies in plain English, no template filler. I always restate the user's exact problem in their words before solving."},
        {"type": "fact", "text": "Refund cap without manager approval is $250. Annual customers get full refund within 14 days, no questions."},
    ],
    "pm": [
        {"type": "fact", "text": "v0.2 roadmap is committed for 2026-07-15 with three themes: streaming responses, cross-device sync, and team workspaces."},
        {"type": "preference", "text": "I write specs as one-pagers with non-goals listed explicitly. Acceptance criteria are testable assertions, not aspirations."},
        {"type": "fact", "text": "Engineering capacity for Q3 is 12 engineer-weeks. Any new initiative >3 weeks needs a tradeoff note against the roadmap."},
    ],
    "finops": [
        {"type": "fact", "text": "Month-end close is day 5 with hard cutoff for AP accruals on day 3. Revenue recognition adjustments go through Olivia Chen."},
        {"type": "preference", "text": "I prefer variance commentary that leads with the driver, then dollars, then % — never the reverse."},
        {"type": "fact", "text": "SOX testing samples 25 transactions per quarter for revenue cycle, 15 for P2P, with material threshold at 5% of opex."},
    ],
    "legal": [
        {"type": "fact", "text": "Our standard NDA has a 3-year term, mutual disclosure, and US-Delaware governing law. Mark Wu must counter-sign any deviation."},
        {"type": "preference", "text": "I want a one-paragraph plain-English risk summary at the top of every contract review before the redline pages."},
        {"type": "fact", "text": "Anything mentioning indemnification cap below 1x ACV needs partner review. Auto-renewal without 90-day notice is unacceptable."},
    ],
    "health": [
        {"type": "fact", "text": "All patient identifiers must be de-identified per HIPAA Safe Harbor (18 identifiers stripped) before any analytics workload runs."},
        {"type": "preference", "text": "I document clinical findings in SOAP format: Subjective, Objective, Assessment, Plan. Always include differential diagnoses."},
        {"type": "fact", "text": "PHI never leaves the VPC. We use AWS HIPAA-eligible services only. BAAs are filed in DocuSign envelope IDs."},
    ],
}

# Industry-shaped style seeds for style/adapt later (per plan).
STYLE_SEEDS: dict[str, list[str]] = {
    "mkt": [
        "I love punchy bullet points and short headlines.",
        "Skip the academic tone. Just give me the punchline.",
        "Bullets are fine but emojis make me cringe.",
        "Lead with the customer quote, never with stats.",
        "Keep emails under 80 words. Always.",
    ],
    "code": [
        "Give me code-first answers, prose second.",
        "Show the diff, then explain why.",
        "I want terse explanations, deeper on the why not the what.",
        "Always include the file path with the snippet.",
        "Show me the failing test first, then the fix.",
    ],
    "sales": [
        "Warm and direct, not formal. Get to the point.",
        "Bullet the next three actions, then the why.",
        "Frame everything as champion-buyer-decider.",
        "Skip the academic framing, just the next-step move.",
        "Always cite the deal stage and ACV.",
    ],
    "cs": [
        "Restate the user's problem in their words first.",
        "Bullets, not paragraphs.",
        "Warm and direct. No template filler.",
        "Plain English only. Skip the jargon.",
        "One question per follow-up, never two.",
    ],
    "pm": [
        "One-pager format only. No essays.",
        "Bullets with non-goals listed explicitly.",
        "Lead with the user outcome, then the engineering work.",
        "Be terse on the what, deep on the why.",
        "Always show the tradeoff against the roadmap.",
    ],
    "finops": [
        "Lead with the driver, then dollars, then %.",
        "Tables over prose for anything with numbers.",
        "Be terse. I read a hundred of these a day.",
        "Format variance commentary as 3 columns: driver, $, %.",
        "Academic tone is fine for footnotes only.",
    ],
    "legal": [
        "One-paragraph plain-English risk summary at the top.",
        "Detailed redlines as bullets underneath.",
        "Academic depth is welcome on indemnification clauses.",
        "Always cite the section number when referencing the contract.",
        "No emojis. Ever.",
    ],
    "health": [
        "SOAP format please. Always.",
        "Clinical tone, no warmth.",
        "Bullets for differential diagnoses, prose for assessment.",
        "Deep on the why, terse on the what.",
        "Cite the DSM/ICD reference when relevant.",
    ],
}


def post(path: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "X-N0Tune-API-Key": "replace-with-local-development-key",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": "unparseable"}


def main() -> int:
    rows = []
    for industry, memories in INDUSTRIES.items():
        for mem in memories:
            status, body = post(
                "/v1/memories",
                {"app_id": "demo", "user_id": industry, "type": mem["type"], "text": mem["text"]},
            )
            ok = status == 200 or status == 201
            mem_id = body.get("id", "?")
            rows.append({"industry": industry, "ok": ok, "id": mem_id, "type": mem["type"]})
            print(f" {'+' if ok else 'x'} {industry:7s} {mem['type']:11s} -> {mem_id} (status={status})")

    print("--- style seeds ---")
    for industry, seeds in STYLE_SEEDS.items():
        for s in seeds:
            status, body = post(
                "/v1/memories",
                {"app_id": "demo", "user_id": industry, "type": "preference", "text": s},
            )
            print(f" {'+' if 200 <= status < 300 else 'x'} {industry:7s} style    -> {body.get('id','?')[:30]}")

    ok = sum(1 for r in rows if r["ok"])
    print(f"core memories: {ok}/{len(rows)} created")
    return 0 if ok == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
