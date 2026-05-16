# Dogfooding

We use N0Tune to build N0Tune. This page captures what we've actually wired
up — not aspirations.

## The dogfooding pass we run

```bash
docker compose up -d --wait
pwsh scripts/seed-dogfooding.ps1
pwsh scripts/smoke-mvp.ps1
python -m evals token_savings
```

What each step does:

1. **`seed-dogfooding.ps1`** — POSTs three N0Tune project memories
   (positioning, license, doc preference) and indexes
   [docs/context-compiler.md](context-compiler.md). The script
   computes a content hash so re-running it skips duplicate uploads.
2. **`smoke-mvp.ps1`** — round-trips health, memory create/list, style
   profile, document upload + injection scoring, context preview, chat,
   and cache. Each run uses a fresh `user_id` so it never collides.
3. **`python -m evals token_savings`** — runs the only fully-implemented
   eval. See [benchmarks.md](benchmarks.md) for the latest numbers.

## What's been tested through this loop

- Memory CRUD with secret rejection
- Style profile merge
- Document chunking + prompt-injection scoring
- Context preview selecting the right memories and chunks
- Token-savings estimate (eval and live API agree directionally)
- Chat with the dev provider, cache hit on the second identical call
- Cache invalidation when a dependent memory is edited
- OpenAI-compatible proxy (`/v1/openai/chat/completions`) including SSE
  streaming
- API key CRUD + role enforcement
- Audit log entries for every mutation
- Memory lifecycle: confirm endpoint, soft-delete, export
- Memory scope: user-scoped private vs. team-scoped shared

## What broke and what we changed

Honest list of regressions caught by this loop:

- **The first time we wired `last_used_at`** the semantic cache started
  missing on the second chat. Root cause: `onupdate=now_utc` on
  `memories.updated_at` was bumping the timestamp on every retrieval, so
  the cache's dependency-freshness check treated the memory as edited.
  Fix: drop `onupdate` from that column and bump `updated_at` only from
  the routes that change content. See the comment on `Memory.updated_at`
  in [`apps/api/app/models/entities.py`](../apps/api/app/models/entities.py).

- **The first eval run** showed 0 % token savings. Root cause: the
  scenario was too small to force the compiler to exclude anything, and
  the API's own naive estimator wasn't pessimistic enough. Fix:
  - The eval now computes its own "stuff everything in" baseline locally
    (verbose system prompt + 8 turns of fake history + every memory +
    every doc) rather than trusting the API's internal estimate.
  - The scenario now seeds 23 memories per app (some noise) and 12 docs
    (7 noise).
  - With that shape we land at 17.4 % savings — small but real and
    reproducible. See [benchmarks.md](benchmarks.md).

- **The pytest collection collision** on `test_integration.py` (LangChain
  and LlamaIndex both ship one). Workaround documented in
  [testing.md](testing.md); the workaround is "run per-package," which
  is also what CI does.

## Dogfooding the docs themselves

Once you've run `seed-dogfooding.ps1`, ask the compiler about N0Tune:

```bash
curl -s -X POST http://localhost:8000/v1/context/preview \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "n0tune_dogfood",
        "message": "How does the context compiler decide what to include?"
      }' | jq '{ selected_memories: .selected_memories | map(.text),
                 selected_chunks: .selected_chunks | map(.text),
                 prompt_tokens_estimated, tokens_saved_estimated }'
```

You should see the seeded memory about positioning, plus chunks from
`docs/context-compiler.md`. That output is the smallest possible proof
that "N0Tune uses N0Tune" isn't a slogan.

## Headline number, last refresh

From [benchmarks.md](benchmarks.md) (token_savings_eval,
two_user_personalization scenario):

| Metric                     | Value      |
| -------------------------- | ---------- |
| Tokens saved per query     | ~236       |
| Tokens saved (percent)     | **17.4 %** |
| Compiled context tokens    | ~1,118     |
| Naive baseline tokens      | ~1,354     |

Reproduce locally with:

```bash
python -m evals token_savings
```

The number is conservative because the eval uses the deterministic hash
embedding backend so CI stays keyless. With a real embedding provider
(`N0TUNE_EMBEDDING_PROVIDER=openai` or `fastembed`) the compiler picks
relevant chunks more cleanly and the percent goes up.

## What this does **not** cover (yet)

- Long conversations. The seed script asks a single question; the eval
  asks two. Multi-turn dialog with history compression is on the roadmap.
- Real LLM judge for answer quality. The
  [`answer_quality_eval`](../evals/answer_quality_eval/) placeholder
  exists; we haven't picked a judge yet.
- Production traffic. These numbers come from an in-process API on
  SQLite. Real Postgres + pgvector behaves the same logically but is
  slower at small scale.

## How to extend this loop

When you add a feature:

1. Write the test in `apps/api/app/tests/` first.
2. Make `smoke-mvp.ps1` exercise the new path if it's user-visible.
3. If it changes selection quality, add a scenario to
   `evals/token_savings_eval/scenarios.json` and re-run `python -m evals`.
4. Update this doc's "what's been tested through this loop" list.

Principle: every claim about N0Tune in the README should be reachable from
this loop in under ten minutes.
