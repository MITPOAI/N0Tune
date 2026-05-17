# Context Guard

> **Phase CG-0 — design only.** Nothing in this document ships as code
> yet. This page captures what Context Guard *will be* so contributors,
> reviewers, and AI agents stay aligned on the shape of the feature
> before any of it is implemented.

## What Context Guard is

Context Guard is N0Tune's alignment + grounding layer. It checks whether
an AI agent's proposed response, plan, or code change stays aligned with
the N0Tune project's stored direction, current roadmap phase, known
decisions, security rules, and benchmark facts.

The one-line pitch:

> **N0Tune keeps AI agents grounded in the project plan.**

Or, in the way most users will encounter it:

> N0Tune reminds the model when it forgets what we already decided.

Context Guard is **not** a generic LLM judge. It uses N0Tune's own
memory, indexed docs, roadmap, tests, and context trace as its source of
truth. When an AI agent drifts away, Context Guard quotes the rule or
memory the agent contradicted.

## Why it exists

AI coding agents hallucinate. In a multi-session project they will, with
high frequency:

- claim tests passed when they did not
- implement features outside the current phase
- add fake endpoints
- ignore docs
- change product positioning
- expose secrets
- store private memory incorrectly
- say "N0Tune fine-tunes Gemini" when N0Tune does not fine-tune anything
- add complex features too early
- break the roadmap
- create placeholder code and call it done

Context Guard catches that drift before it lands in main. The agent
either corrects itself, or the human reviewer gets a clear "this
contradicts the project plan because…" report.

This matters specifically for N0Tune because:

1. The project is **multi-phase** with explicit phase boundaries (CG-0
   is documentation only; CG-1 adds the rule engine; etc.). Agents that
   ignore the phase boundary make a mess.
2. The product is **easy to misframe** ("armor", "fine-tunes",
   "personal AI runtime") because the underlying idea — context-tuning
   — is non-obvious. Earlier reframes already drifted twice; Context
   Guard is the fix.
3. We **dogfood** N0Tune to build N0Tune. The memory + docs we ingest
   *are* the source of truth; Context Guard is the read-side of that
   loop.

## The ten alignment questions

For any proposed response, plan, or diff, Context Guard answers:

1. Is this aligned with the **current N0Tune direction**? (Context-tuning,
   not fine-tuning; two surfaces — Desktop + integration layer.)
2. Is it **within the current roadmap phase**?
3. Does it **contradict stored project decisions**? (e.g. "MCP must be
   local-only by default.")
4. Does it **invent features that do not exist**? (e.g. "all providers
   supported" when only three wire shapes ship.)
5. Does it **claim something is done when it is not**? (e.g. "Desktop
   app is complete" with only docs landed.)
6. Does it **ignore security rules**? (e.g. binding MCP to 0.0.0.0,
   storing secrets as memories.)
7. Does it **violate memory/privacy rules**? (e.g. persona sharing
   leaking private memories.)
8. Does it **introduce overengineering**? (e.g. Kubernetes before
   Desktop alpha.)
9. Does it **confuse "context-tuning" with real fine-tuning**?
10. Should N0Tune **warn, block, or suggest correction**?

## How an agent uses Context Guard

The intended workflow inside an MCP-capable agent (Claude Code, Cursor,
Codex CLI, …) is:

```
User: "Implement the next N0Tune phase."

Agent: <calls n0tune_get_current_plan>      // What phase are we in?
Agent: <calls n0tune_remind_context>        // What are the rules?
Agent: <drafts implementation plan>
Agent: <calls n0tune_alignment_check>       // Is my plan aligned?

  If aligned:    proceed with the work.
  If not aligned: read the issues + suggested_correction,
                  revise the plan, re-check, then proceed.
```

The agent can also call `n0tune_alignment_check` on its **finished
output** — claims, diff summary, completion report — so the *summary*
sent back to the user is grounded too, not just the plan.

## What Context Guard checks against

| Source                                  | Where it lives today                                  | Used to detect                                  |
| --------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Current product direction               | `docs/product-direction.md`                           | Direction drift, positioning drift              |
| Current phase / roadmap                 | `docs/roadmap.md`, `CHANGELOG.md`                     | Phase drift, premature work                     |
| Architectural decisions                 | `docs/architecture.md`, `docs/desktop-architecture.md`| Decision contradiction                          |
| Security rules                          | `docs/security.md`, `docs/prompt-injection.md`        | Security risk, secret storage, untrusted RAG    |
| Memory + privacy rules                  | `docs/memory-scopes.md`, `docs/memory-lifecycle.md`   | Cross-user leakage, persona-sharing leakage     |
| Benchmark facts                         | `docs/benchmarks.md`, `docs/token-savings-report.md`  | Hallucinated numbers (e.g. "80% savings")       |
| Project memories (Gateway)              | `memories` table, scoped to `app_id=n0tune`           | Stored decisions, terminology corrections       |
| Forbidden-phrase + terminology rules    | `alignment_rules` table (CG-1+)                       | "fine-tunes GPT", "trains Claude", etc.         |
| Tests                                   | `apps/api/app/tests/`, `*/tests/`, e2e                | "Tests pass" claim vs. actual test files        |

The first six already exist as N0Tune docs and memories. CG-1 will add
the `alignment_rules` table for fast pattern checks; CG-2 wires the API
endpoint that combines all of the above.

## Concrete examples of drift Context Guard catches

### Example 1 — terminology

**Agent says:** "N0Tune fine-tunes Gemini 3.1 using local memory."

**Context Guard:**
```
type: terminology_error
severity: high
finding: Claim contradicts the project's core terminology rule.
evidence: docs/product-direction.md and memory mem_<...> both state:
          "N0Tune context-tunes models. It does not change weights."
recommendation: Rephrase as "N0Tune personalizes Gemini 3.1 through
                local memory and context. It does not fine-tune."
```

### Example 2 — phase drift

**Agent during Phase CG-0:** "I implemented the Tauri desktop app and
the alignment-check route."

**Context Guard:**
```
type: phase_drift
severity: high
finding: Implementation is outside Phase CG-0.
evidence: docs/roadmap.md says CG-0 is design-only.
          CG-2 is when the API endpoint lands.
recommendation: Limit changes to docs/context-guard.md, docs/roadmap.md,
                docs/architecture.md, docs/testing.md, CHANGELOG.md.
```

### Example 3 — security risk

**Agent ships:** an MCP server bound to `0.0.0.0:8765`.

**Context Guard:**
```
type: security_risk
severity: critical
finding: MCP exposed on a public interface by default.
evidence: docs/security.md: "MCP must be local-only by default
          (stdio transport, no network listener)."
recommendation: Revert to stdio transport.
```

### Example 4 — benchmark hallucination

**Agent claims:** "Token savings are 80%."

**Context Guard:**
```
type: hallucinated_claim
severity: medium
finding: 80% does not match the documented benchmark.
evidence: docs/benchmarks.md reproduces 17.4% token savings with the
          two_user_personalization scenario.
recommendation: Either cite the 17.4% figure, or add a new eval that
                actually reproduces 80% before claiming it.
```

### Example 5 — secret storage

**Agent stores memory:** `"OPENAI_API_KEY=sk-AbCdEf012345..."`

**Context Guard:**
```
type: security_risk → secret_storage
severity: critical
finding: Memory text matches a known secret pattern.
evidence: services/security/secrets.py detects sk-* / sk-ant-* /
          ghp_* / AKIA* prefixes.
recommendation: Reject the memory. Redact the secret in any echo.
```

## Output format (planned)

Context Guard always returns structured JSON, then a human-readable
summary derived from it.

```json
{
  "aligned": false,
  "risk_level": "high",
  "summary": "The plan claims desktop is implemented, but Phase CG-0 is documentation-only.",
  "issues": [
    {
      "type": "phase_drift",
      "severity": "high",
      "finding": "Desktop implementation outside current phase.",
      "evidence": "docs/roadmap.md: CG-0 = docs only.",
      "recommendation": "Limit changes to docs."
    }
  ],
  "allowed_next_actions": [
    "Update docs/product-direction.md",
    "Update docs/roadmap.md"
  ],
  "blocked_actions": [
    "Implement Tauri changes",
    "Claim desktop is complete"
  ],
  "suggested_correction": "Reframe as a Phase CG-0 documentation update only."
}
```

Issue types Context Guard will emit:

- `phase_drift`
- `hallucinated_claim`
- `security_risk`
- `doc_mismatch`
- `overengineering`
- `terminology_error`
- `missing_test`
- `memory_conflict`
- `benchmark_mismatch`
- `secret_storage`

`risk_level` ranges `low | medium | high | critical`. A `critical`
finding (security, secret storage) is intended to **block** the action;
`high` is a strong warn; `medium` and `low` are advisory.

## Planned surfaces

Context Guard will ship in four places, all consuming the same
`/v1/alignment/check` core:

| Surface       | Lands in   | What it gives you                                                          |
| ------------- | ---------- | -------------------------------------------------------------------------- |
| **API**       | CG-2       | `POST /v1/alignment/check`, `POST /v1/alignment/check-diff`, `GET/POST /v1/alignment/rules` |
| **Dashboard** | CG-3       | A "Context Guard" page (run a check) + a "Project Rules" page (view the active rules) |
| **CLI**       | CG-4       | `n0tune align check`, `n0tune align diff`, `n0tune align rules`, `n0tune align doctor` |
| **MCP**       | CG-5       | `n0tune_alignment_check`, `n0tune_get_current_plan`, `n0tune_remind_context` |

The technical contract for each surface lives in
[`docs/alignment-checker.md`](alignment-checker.md). The first
dogfooding pass — running Context Guard against N0Tune's own docs and
agent summaries — is documented in
[`docs/dogfooding-alignment.md`](dogfooding-alignment.md).

## Implementation phases

| Phase | Scope                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| CG-0  | **Design only** (this doc set). No code. Goal: contributors and AI agents share one mental model of the feature. |
| CG-1  | Rule engine: forbidden phrases, phase-scope rules, security patterns, benchmark claim checks. Pure deterministic. |
| CG-2  | `/v1/alignment/check` endpoint + tests. Reads rules + N0Tune memories + project docs.                             |
| CG-3  | Dashboard page (Context Guard tab) and Project Rules viewer.                                                      |
| CG-4  | `n0tune align` CLI commands.                                                                                      |
| CG-5  | MCP tools (`n0tune_alignment_check`, `n0tune_get_current_plan`, `n0tune_remind_context`).                          |
| CG-6  | Dogfooding pass: run Context Guard against N0Tune's own README / roadmap / recent agent summaries. Document hits, misses, false positives. |

## Security considerations (design)

- Context Guard **must not call upstream LLMs by default.** The basic
  rule-based + retrieval-based checks run deterministically with no
  network egress. An LLM-judge mode is a CG-5+ opt-in and must output
  structured JSON with cited evidence.
- Context Guard **must not auto-execute corrections.** It produces a
  report; humans (or higher-order agent tooling) decide whether to
  accept the suggested correction. The MVP returns suggestions, not
  diffs that apply themselves.
- Context Guard reads from the same Gateway tables that already enforce
  app/user scope. No cross-app rule leakage; no cross-user memory
  retrieval inside an alignment check.
- The `alignment_rules` table is **admin-only on write**
  (`POST /v1/alignment/rules` requires `owner` or `admin` role per the
  existing RBAC). Reads can be public so agents can see "what plan am I
  expected to follow?" without escalating permission.

## What CG-0 explicitly does *not* do

To keep the design phase honest:

- CG-0 does **not** ship any rules data.
- CG-0 does **not** ship the `/v1/alignment/check` endpoint.
- CG-0 does **not** ship CLI commands.
- CG-0 does **not** ship MCP tools.
- CG-0 does **not** change the existing semantic cache, context
  compiler, provider router, or memory consolidation. Those continue to
  work exactly as in v0.1.2.
- CG-0 does **not** introduce any new dependencies.
