"""Run cross-namespace contamination probes + style/adapt per industry.

Cross-contamination: query 4 sampled pairs (user_id != owner) for the
owner's tactical probe; expect ZERO leakage of the owner's tactical-fact
memory into the foreign namespace's preview.

Style adapt: per industry, POST /v1/users/{user_id}/style/adapt and
record the suggested profile. Manually tag "industry-shaped" vs.
"generic-but-correct" based on whether the profile actually changed from
the default.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"
KEY = "replace-with-local-development-key"

PAIRS = [
    ("audit_seed", "mkt", "When does Skyline Q3 launch?", "Skyline"),
    ("mkt", "health", "What's our PHI de-identification standard?", "HIPAA"),
    ("code", "legal", "What's our standard NDA term?", "NDA"),
    ("sales", "finops", "When is month-end close?", "Olivia"),
]

INDUSTRIES = ["mkt", "code", "sales", "cs", "pm", "finops", "legal", "health"]


def http(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-N0Tune-API-Key": KEY}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def main() -> int:
    out: dict = {"contamination": [], "style_adapt": [], "default_style": None}

    print("=== contamination probes ===")
    for query_user, owner_user, query, owner_keyword in PAIRS:
        status, resp = http("POST", "/v1/context/preview",
                            {"app_id": "demo", "user_id": query_user, "message": query,
                             "max_context_tokens": 1500})
        mem_texts = [m.get("text", "") for m in resp.get("selected_memories", [])]
        leaked = any(owner_keyword.lower() in t.lower() for t in mem_texts)
        # also check memory_ids from owner namespace — semantic match is the real
        # contamination risk
        out["contamination"].append({
            "query_namespace": query_user,
            "owner_namespace": owner_user,
            "query": query,
            "owner_keyword": owner_keyword,
            "memories_returned": len(mem_texts),
            "any_owner_keyword_present": leaked,
            "memory_texts_sample": [t[:70] for t in mem_texts[:5]],
        })
        marker = "LEAK" if leaked else "ok"
        print(f"  {query_user:10s} querying for '{owner_user}' fact -> {marker} ({len(mem_texts)} mems)")

    print("\n=== style adapt per industry ===")
    # Capture default style first (no memories under a fresh user_id)
    status, default_resp = http("GET", "/v1/users/__never_seen__/style?app_id=demo")
    out["default_style"] = default_resp
    print(f"default style baseline: {json.dumps(default_resp.get('profile_json'), separators=(',',':'))[:120]}")

    for industry in INDUSTRIES:
        # Run adapt
        status, adapt_resp = http("POST", f"/v1/users/{industry}/style/adapt?app_id=demo", body={})
        # Read effective style
        status_g, get_resp = http("GET", f"/v1/users/{industry}/style?app_id=demo")
        profile = get_resp.get("profile_json", {})
        out["style_adapt"].append({
            "industry": industry,
            "adapt_response": adapt_resp,
            "effective_profile": profile,
        })
        print(f"  {industry:7s} effective: {json.dumps(profile, separators=(',',':'))[:160]}")

    out_path = r"C:/Dev/IMME internal/N0Tune/scripts/.contamination_results.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\nwrote {out_path}")

    leaks = sum(1 for r in out["contamination"] if r["any_owner_keyword_present"])
    print(f"\ncontamination leaks: {leaks}/{len(out['contamination'])}  (0 expected)")

    return 0 if leaks == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
