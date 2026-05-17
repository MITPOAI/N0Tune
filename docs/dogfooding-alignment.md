# Dogfooding Context Guard

> **Phase CG-0 — plan only.** This document is the dogfooding agenda
> for Context Guard. The actual pass runs in CG-6, after CG-1 through
> CG-5 land. Today this page is the contract for that pass.

## The dogfooding loop, in one sentence

We run N0Tune's Context Guard against N0Tune's own README, roadmap,
recent agent completion summaries, and ongoing PR diffs — and we ship
the results back into the project so the next agent stays grounded.

If Context Guard cannot catch the drift in N0Tune's own history, it
will not catch it in anyone else's project. So N0Tune is the first
real-world test of the alignment engine.

## What we run Context Guard against

The CG-6 pass exercises Context Guard on these eight artifacts. Each
should produce a known result; deviations from those results are bugs.

| # | Artifact                                                                | Expected verdict                                                                                                  |
| - | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1 | Current `README.md`                                                     | `aligned: true`. Sanity check — Context Guard must not false-positive on the project's own README.                |
| 2 | Current `docs/product-direction.md`                                     | `aligned: true`. Same as above for the canonical direction doc.                                                   |
| 3 | The v0.1.0 release body                                                 | `aligned: false`, `risk_level: medium`. Reasons: framing ("Personal AI Runtime") differs from current direction.  |
| 4 | The v0.1.1 release body                                                 | `aligned: false`, `risk_level: medium`. Reasons: "armor for AI tools" was over-pivoted — see v0.1.2 release notes.|
| 5 | The v0.1.2 release body                                                 | `aligned: true`. Should pass cleanly because the framing was corrected in v0.1.2.                                 |
| 6 | A synthetic agent claim: "N0Tune fine-tunes Gemini 3.1."                | `aligned: false`, `risk_level: high`. Must fire `terminology_error` rule.                                         |
| 7 | A synthetic agent claim: "I implemented the Tauri app in Phase CG-0."   | `aligned: false`, `risk_level: high`. Must fire `phase_drift`.                                                    |
| 8 | A synthetic agent claim: "Token savings are 80%."                       | `aligned: false`, `risk_level: medium`. Must fire `benchmark_mismatch` citing `docs/benchmarks.md` 17.4%.         |

Artifacts 1, 2, and 5 establish the **false-positive ceiling** (real
project docs that should pass). Artifacts 3 and 4 establish the
**recall floor** on historical drift we know happened. Artifacts 6, 7,
and 8 are the **synthetic positives** — the exact cases the rule
engine was designed to catch.

## Pass / fail criteria

A CG-6 pass passes when:

- Artifacts 1, 2, 5 return `aligned: true` (no false positives).
- Artifacts 3, 4 return `aligned: false` with at least one
  `terminology_error` or `product_direction` issue citing the right
  source (memory id or doc path).
- Artifacts 6, 7, 8 return `aligned: false` with the matching issue
  type and a `recommendation` that quotes the rule.
- Total runtime under 5 seconds against the local Gateway.
- Zero LLM tokens spent (rule_engine + retrieval_check only; no
  `llm_judge`).

## What CG-6 produces

The pass writes its results to `docs/releases/v0.2.0-cg-dogfooding.md`
(the next release after CG ships). The doc captures:

1. The eight artifacts above, each with its full `AlignmentReport`.
2. Any **false positives** observed (real docs flagged incorrectly).
   For each, we either tune the rule or delete it. The goal is fewer
   false positives, not more rules.
3. Any **false negatives** observed (synthetic drift Context Guard
   missed). For each, we add the missing rule and re-run.
4. The final rule set after tuning. This becomes the seed rule set for
   future projects that adopt N0Tune.

## How the pass is run

```bash
# Boot the stack (same as the rest of dogfooding):
docker compose up -d --wait

# Seed the alignment rule set:
n0tune align rules --import scripts/cg6-rules.jsonl

# Run the eight artifacts:
n0tune align check --phase "v0.1.2" --file README.md --json > /tmp/cg6/01.json
n0tune align check --phase "v0.1.2" --file docs/product-direction.md --json > /tmp/cg6/02.json
n0tune align check --phase "v0.1.0" --file docs/releases/v0.1.0.md --json > /tmp/cg6/03.json
n0tune align check --phase "v0.1.1" --file docs/releases/v0.1.1.md --json > /tmp/cg6/04.json
n0tune align check --phase "v0.1.2" --file docs/releases/v0.1.2.md --json > /tmp/cg6/05.json
n0tune align check --phase "v0.1.2" --content "N0Tune fine-tunes Gemini 3.1." --json > /tmp/cg6/06.json
n0tune align check --phase "CG-0" --content "I implemented the Tauri app." --json > /tmp/cg6/07.json
n0tune align check --phase "v0.1.2" --content "Token savings are 80%." --json > /tmp/cg6/08.json

# Aggregate + format:
python scripts/format_cg6_report.py /tmp/cg6/ > docs/releases/v0.2.0-cg-dogfooding.md
```

(The format script is part of CG-6; the CLI flags are part of CG-4.)

## Honest expectations

The first CG-6 run will probably produce noise. Specifically:

- **Artifact 3 (v0.1.0)** uses "Personal AI Runtime" as its primary
  framing. Context Guard's current direction rule says that's
  out-of-date language. But v0.1.0 was *correct at the time it
  shipped*. We need a rule that knows about phase — "at v0.1.0,
  'Personal AI Runtime' was correct; at v0.1.2 it is not". CG-6 may
  expose that we need a `phase_aware: true` flag on `terminology`
  rules.
- **Artifact 4 (v0.1.1)** uses "armor for AI tools" — the same
  problem. The fix is the same.
- **Artifact 5 (v0.1.2)** may trip the existing forbidden-phrase rule
  for "armor" in its self-referential history paragraphs. The fix is
  to scope phrase rules to *claims*, not *historical references*.

The CG-6 pass documenting these subtleties **is the point**. Context
Guard is only useful if it catches real drift without flagging every
honest historical reference. The first dogfooding pass is where we
learn that.

## Connection to existing dogfooding

The general dogfooding pass — [`docs/dogfooding.md`](dogfooding.md) —
already ingests project memories and indexes the armor / context-tuning
docs. Context Guard's dogfooding reuses that loop:

1. The seed pass populates project memories Context Guard then
   retrieves from.
2. Context Guard checks claims against those exact memories.

If `docs/dogfooding.md` falls out of date, Context Guard will fail to
retrieve the right evidence and will degrade silently. So
`scripts/seed-dogfooding.ps1` is part of the Context Guard test
fixture, not just a "nice to have."

## What this document is *not*

- Not a test plan for the rule engine — that lives in
  [`docs/testing.md`](testing.md).
- Not the spec for the API or MCP surface — that lives in
  [`docs/alignment-checker.md`](alignment-checker.md).
- Not the user-facing pitch — that lives in
  [`docs/context-guard.md`](context-guard.md).

This page is **only** the dogfooding agenda.
