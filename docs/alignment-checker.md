# Alignment Checker — technical design

> **Phase CG-0 — design only.** No code lands in this document set.
> This page is the contract that CG-1 through CG-5 will implement.
> User-facing framing lives in [`docs/context-guard.md`](context-guard.md);
> this page is for implementers and reviewers.

The Alignment Checker is the engine behind N0Tune's user-facing
"Context Guard" surface. The split:

- **Context Guard** = the product. What users / agents see.
- **Alignment Checker** = the engine. How it works internally.

## Architecture (planned)

```
┌─────────────── inputs ───────────────┐
│  agent output / plan / diff / claims │
│  + current phase + app_id + user_id  │
└─────────────────┬────────────────────┘
                  │
                  ▼
     ┌─────────────────────────────┐
     │  rule_engine (CG-1)          │   deterministic, no LLM
     │  • forbidden-phrase regex    │
     │  • phase-scope rules         │
     │  • security pattern checks   │
     │  • benchmark-claim checks    │
     └─────────────┬───────────────┘
                   │
                   ▼
     ┌─────────────────────────────┐
     │  retrieval_check (CG-2)      │   reuses compiler.py
     │  • pull relevant memories    │
     │  • pull relevant doc chunks  │
     │  • compare claim vs. source  │
     └─────────────┬───────────────┘
                   │
                   ▼
     ┌─────────────────────────────┐
     │  (optional) llm_judge (CG-5)  │   provider router, structured
     │  • only when configured      │   JSON, must cite evidence
     └─────────────┬───────────────┘
                   │
                   ▼
           ┌──────────────┐
           │  combine()   │
           └──────┬───────┘
                  ▼
          AlignmentReport
```

The engine is layered so each layer can be tested in isolation and the
later layers are optional. A user with no provider configured still
gets useful checks from CG-1 alone.

## API surface (planned)

### POST /v1/alignment/check

Checks one proposed output or plan.

Request:

```json
{
  "app_id": "n0tune",
  "user_id": "claude-code",
  "phase": "CG-0",
  "content": "Agent output or proposed plan here",
  "changed_files": ["docs/roadmap.md"],
  "claims": [
    "Desktop app is implemented",
    "N0Tune fine-tunes any model"
  ],
  "strict": true
}
```

- `phase` is the roadmap phase the agent is supposed to be working in.
  If omitted, Context Guard reads the most-recent `## ` heading from
  `docs/roadmap.md` and uses that.
- `claims` is an optional explicit list. If present, each claim gets
  checked individually with its own issue (if any).
- `strict: true` treats `medium`-severity findings as blockers too, not
  just advisory. Default `false`.

Response: an `AlignmentReport` (see below).

### POST /v1/alignment/check-diff

Same as `/check` but takes a unified diff instead of `content`.

```json
{
  "app_id": "n0tune",
  "phase": "v0.1",
  "diff": "diff --git a/...",
  "summary": "Plain-text summary of what the diff is supposed to do"
}
```

The diff parser extracts changed file paths and added lines, then runs
the same engine. Useful for pre-commit / PR-comment integration.

### GET /v1/alignment/rules

Public. Returns the active alignment rules in JSON. Agents call this so
they know what they will be checked against:

```json
{
  "rules": [
    {
      "id": "rul_<...>",
      "rule_type": "terminology",
      "title": "Do not claim N0Tune fine-tunes models",
      "description": "N0Tune context-tunes models. It does not change weights.",
      "severity": "high",
      "pattern": "fine-tunes? GPT|trains? Gemini|updates model weights"
    },
    ...
  ]
}
```

### POST /v1/alignment/rules

Admin-only (RBAC: `owner` or `admin`). Adds or updates project alignment
rules. Schema mirrors the row format below.

## Data model

The persisted rules table (lands in CG-1):

```
alignment_rules
├── id                 (text, primary key, "rul_<uuid>")
├── app_id             (text, indexed)
├── rule_type          (text — see below)
├── title              (text)
├── description        (text)
├── severity           (text — low|medium|high|critical)
├── pattern            (text, nullable — regex for rule_engine)
├── metadata_json      (json, nullable — type-specific extra config)
├── active             (boolean, default true)
├── created_at         (timestamp)
└── updated_at         (timestamp)
```

`rule_type` (closed enum at CG-1):

- `product_direction` — what N0Tune is and isn't.
- `terminology` — words to avoid / use (e.g. "fine-tunes" vs "context-tunes").
- `phase_scope` — what's in/out of the current roadmap phase.
- `security` — security invariants (e.g. "MCP local-only by default").
- `memory_policy` — memory/persona privacy rules.
- `roadmap` — feature ordering (e.g. "Desktop alpha before Kubernetes").
- `forbidden_claim` — "tests pass", "all providers supported", etc.
- `required_test` — claims that must come with a passing test.
- `docs_consistency` — README / roadmap / code must agree.

`metadata_json` carries rule-type-specific extras. Examples:

- `phase_scope`: `{"phase": "CG-0", "allowed_paths": ["docs/**", "README.md", "CHANGELOG.md"]}`
- `required_test`: `{"claim_pattern": "tests pass", "test_glob": "apps/**/tests/**"}`
- `forbidden_claim`: `{"claim_pattern": "80% token savings", "actual": 17.4, "source": "docs/benchmarks.md"}`

## Response schema — AlignmentReport

```ts
type Severity = "low" | "medium" | "high" | "critical";

type IssueType =
  | "phase_drift"
  | "hallucinated_claim"
  | "security_risk"
  | "doc_mismatch"
  | "overengineering"
  | "terminology_error"
  | "missing_test"
  | "memory_conflict"
  | "benchmark_mismatch"
  | "secret_storage";

type AlignmentIssue = {
  type: IssueType;
  severity: Severity;
  finding: string;          // 1-sentence statement of the problem
  evidence: string;         // quote + cite (file path or memory id)
  recommendation: string;   // how to fix
  rule_id?: string;         // when triggered by a rule row
};

type AlignmentReport = {
  aligned: boolean;
  risk_level: Severity;
  summary: string;
  issues: AlignmentIssue[];
  allowed_next_actions: string[];
  blocked_actions: string[];
  suggested_correction: string | null;
};
```

`aligned` is `false` if any issue is `severity >= high` (or `>= medium`
when `strict: true`). `risk_level` is the max severity across all
issues. An empty `issues` array means `aligned: true`,
`risk_level: "low"`, and the response is mostly informational.

## Engine layers

### 1. rule_engine — CG-1

Runs the regex / pattern checks against `content`, `claims`, and the
list of `changed_files`. Pure Python, no I/O beyond the rules table.

For each rule row:

- If `pattern` is set: try to match the regex against `content` and
  each `claims` entry. A hit produces an `AlignmentIssue` with
  `rule_id` set.
- If `metadata_json.allowed_paths` is set (phase_scope): check that
  every `changed_file` matches one of the globs.
- If `metadata_json.claim_pattern` is set (forbidden_claim,
  required_test, benchmark_mismatch): match against claims; for
  `required_test`, additionally check that at least one file in
  `test_glob` appears in `changed_files`.

Output: a list of issues with `rule_id`.

### 2. retrieval_check — CG-2

Reuses the existing Context Compiler (`services/context/compiler.py`).
For each `claim` and the overall `content`:

1. Embed the claim.
2. Retrieve the top N memories + chunks for `app_id` (project memories
   live under `app_id = "n0tune"`).
3. If the retrieved memory directly contradicts the claim (cosine
   similarity high AND opposing polarity), emit a `memory_conflict`
   issue citing the memory id.
4. For numeric claims (regex over benchmark numbers), compare against
   the documented number in retrieved chunks; emit `benchmark_mismatch`
   on disagreement.

Output: a list of issues with `evidence` containing the cited memory /
chunk text.

### 3. llm_judge — CG-5 (opt-in)

If `N0TUNE_ALIGNMENT_JUDGE_PROVIDER_*` env vars are set, the engine
sends a compact prompt (rules + retrieved evidence + content) to that
provider and asks for a structured JSON `AlignmentReport`. The judge
must cite evidence; uncited findings are dropped at parse time.

Default: **off**. Reasons:

- Predictable cost. We don't want every chat triggering an extra LLM
  call.
- Determinism. Rule-engine + retrieval is reproducible; LLM judge is not.
- Privacy. The LLM judge sees the agent output, which may be sensitive.

### combine()

Merges issues from each layer, deduplicates by `(type, finding[:80])`,
sorts by severity, and computes the final `risk_level`. Then derives:

- `allowed_next_actions`: union of `metadata_json.allowed_paths` from
  matched `phase_scope` rules, plus a heuristic list ("update docs",
  "add test").
- `blocked_actions`: the action the agent was about to take, restated
  as an explicit "do not" (taken from each issue's `recommendation`
  where available).
- `suggested_correction`: a single-paragraph rewrite of the agent's
  intent that complies with all issues. Deterministically generated
  from the issue list (string concatenation rules) at CG-1/CG-2; can be
  LLM-rewritten at CG-5.

## CLI design (CG-4)

```
n0tune align check --phase "CG-0" --file agent-output.md
n0tune align check --phase "CG-0" --content "I implemented the Tauri app"
n0tune align diff --phase "v0.1" --git HEAD~1..HEAD
n0tune align rules
n0tune align doctor
```

Human-readable output:

```
Aligned: no
Risk:    high
Phase:   CG-0

Issues
------
1. phase_drift (high)
     Desktop implementation is outside CG-0.
     Evidence: docs/roadmap.md line 142.
     Fix:      Limit changes to docs.

2. terminology_error (high)
     "fine-tunes GPT" should be "context-tunes GPT".
     Evidence: rule rul_<...>, docs/product-direction.md.

Suggested correction
--------------------
Reframe the output as a Phase CG-0 documentation update only.
Replace "fine-tunes" with "context-tunes" in all claims.
```

JSON output:

```
n0tune align check --phase "CG-0" --file out.md --json
```

…returns the raw `AlignmentReport` for scripting.

## MCP tools (CG-5)

Three tools wired through the existing MCP server
(`integrations/mcp-server/src/server.mjs`):

1. **`n0tune_alignment_check`** — wraps `POST /v1/alignment/check`.
   Arguments mirror the API request body.
2. **`n0tune_get_current_plan`** — returns the current phase, roadmap
   excerpt, and a short list of stored decisions for the calling app.
   Implementation: read `docs/roadmap.md` + the `alignment_rules` for
   the current phase + recent confirmed memories.
3. **`n0tune_remind_context`** — returns the top N "most important"
   project memories + a compressed product direction blurb. The intent
   is to be called at the *start* of a session before the agent plans
   anything.

Suggested agent prompt template (lives in `docs/wire-to-claude.md` when
CG-5 lands):

> Before you draft a plan, call `n0tune_remind_context`. After you
> draft the plan but before you start writing code, call
> `n0tune_alignment_check` with the plan as `content`. If the report
> is `aligned: false`, revise the plan and re-check.

## Dashboard pages (CG-3)

Two new pages under the existing dashboard:

### "Context Guard" page

- Phase selector (`<select>` populated from `docs/roadmap.md` headings).
- `<textarea>` for proposed agent output / plan.
- Optional comma-separated `claims` input.
- Optional `changed_files` input (glob-style list).
- "Run alignment check" button → calls `POST /v1/alignment/check`.
- Results panel: aligned y/n badge, risk-level chip, issue list (each
  collapsible to show evidence + recommendation), suggested correction,
  allowed/blocked actions.

### "Project Rules" page

Read-only view of the active rules table. Filters by `rule_type` and
`severity`. Each row expands to show the rule's full description and
any `metadata_json`. Admins see an "Edit" affordance that posts to
`POST /v1/alignment/rules`.

## Test plan (CG-1 onwards)

| Test                                                          | Layer                                  |
| ------------------------------------------------------------- | -------------------------------------- |
| `terminology` rule catches "fine-tunes GPT"                   | rule_engine unit                       |
| `phase_scope` blocks Desktop changes during CG-0              | rule_engine unit                       |
| `security` flags MCP bound to 0.0.0.0                         | rule_engine unit                       |
| `benchmark_mismatch` flags "80% savings" vs documented 17.4%  | retrieval_check integration            |
| `secret_storage` blocks `OPENAI_API_KEY=sk-...` in memory     | already handled by services/security; rule wraps it |
| `memory_conflict` flags claim contradicting stored memory     | retrieval_check integration            |
| `missing_test` flags "tests pass" without a `tests/` file     | rule_engine + diff parser              |
| `combine()` dedupes overlapping findings                      | combine unit                           |
| API endpoint returns valid `AlignmentReport` schema           | API integration                        |
| LLM judge falls back gracefully when no provider configured   | llm_judge unit                         |
| Dashboard "Run alignment check" round-trips                   | Playwright e2e                          |

## Non-goals (explicit)

- Context Guard does **not** auto-rewrite agent output. It returns a
  suggested correction; the agent or human decides what to do.
- Context Guard does **not** replace human review on PRs.
- Context Guard does **not** introduce a new database; it reuses the
  Gateway's Postgres.
- Context Guard does **not** ship with telemetry. Same product promise
  as the rest of N0Tune.

## Open questions for CG-1 to resolve

1. Where does the LLM-judge prompt template live? Probably
   `packages/core/src/n0tune_core/alignment/judge_prompt.py`, so the
   Desktop's Rust side can reuse it later.
2. Should `allowed_next_actions` be persisted (per-app history) or
   recomputed each call? Lean toward recomputed.
3. Default cooldown for the `n0tune_alignment_check` MCP tool — should
   we throttle so a chatty agent doesn't call it 100x per session? Lean
   toward no throttle in CG-2; revisit if needed.
4. How does the alignment check interact with the semantic cache?
   Probably caches **read-only** retrievals (memories, chunks) but
   never the final report (the rules can change).
