# Dogfooding

We use N0Tune to build N0Tune. The dogfooding loop runs through the
Gateway because that's the easiest end-to-end proving ground; the same
behaviors are moving behind `packages/core` so Desktop can reuse them
locally without Docker.

Since v0.1.2 the seed pass indexes the docs that explain the project
to other AI tools — `product-direction.md`, `how-it-works.md`,
`install.md`, `wire-to-*.md`, `CLAUDE.md`, `AGENTS.md` — plus the
`context-compiler.md` reference. That way, when you ask any MCP-wired
client "what is N0Tune?", the answer comes back framed correctly: a
context-tuning system that gives any LLM your personal context without
fine-tuning, consumable as a standalone Desktop app or as an
integration layer.

## Why Gateway Dogfooding Still Matters

Desktop is the public product direction, but the current Gateway already exercises the core ideas:

- memory creation and retrieval
- style profile merge
- document chunking
- prompt-injection scoring
- context preview
- chat with provider routing
- semantic cache
- memory lifecycle and scopes
- RBAC and audit logs
- token-savings evaluation

Those behaviors are moving behind N0Tune Core interfaces so Desktop can reuse them with SQLite/local vector storage instead of Postgres and Redis.

The first Phase B slice extracted token estimation, stable hashing, hash embeddings, lexical scoring, prompt/security scanning, score blending, and context rendering into `packages/core`. Gateway still owns SQLAlchemy persistence, API routes, provider HTTP calls, and cache dependency checks.

## The Dogfooding Pass We Run

```bash
docker compose up -d --wait
pwsh scripts/seed-dogfooding.ps1
pwsh scripts/smoke-mvp.ps1
python -m evals token_savings
```

What each step does:

1. `seed-dogfooding.ps1` posts the context-tuning project memories
   (Apache-2.0, zero telemetry, no hardcoded model, Windows/macOS/Linux
   only, both Desktop and integration surfaces are first-class) and
   indexes the docs listed above. The script computes a content hash per
   doc so re-running it skips duplicate uploads. It also fires three
   context previews ("how does N0Tune compile context?", "what is N0Tune
   and how does it work without fine-tuning?", "how do I wire N0Tune to
   Claude Code?") so you can eyeball what the compiler returns end-to-end.
2. `smoke-mvp.ps1` round-trips health, memory create/list, style profile, document upload, injection scoring, context preview, chat, and cache. Each run uses a fresh `user_id`.
3. `python -m evals token_savings` runs the implemented token-savings eval. See [benchmarks.md](benchmarks.md).

## What Has Been Tested Through This Loop

- Memory CRUD with secret rejection
- Style profile merge
- Document chunking and prompt-injection scoring
- Context preview selecting relevant memories and chunks
- Token-savings estimate
- Chat with the dev provider
- Cache hit on the second identical call
- Cache invalidation when a dependent memory is edited
- OpenAI-compatible proxy including SSE streaming
- API key CRUD and role enforcement
- Audit log entries for mutations
- Memory lifecycle: confirm endpoint, soft delete, export
- Memory scope: user-scoped private memory vs shared memory

## What Broke and What We Changed

Honest regressions caught by this loop:

- `last_used_at` originally caused semantic-cache misses on the second chat. Root cause: updating retrieval metadata also bumped `memories.updated_at`, so dependency-freshness checks treated the memory as edited. Fix: remove automatic `updated_at` bumping for retrieval metadata and only update content timestamps from mutation routes.
- The first eval run showed 0 percent token savings. Root cause: the scenario was too small and the naive baseline was not pessimistic enough. Fix: compute a local "stuff everything in" baseline and seed enough noise memories/docs to force selection.
- Pytest collected duplicate `test_integration.py` module names for LangChain and LlamaIndex. Workaround: run per-package, which is also how CI is structured.

## Desktop-Relevant Dogfooding

As Desktop work begins, every Gateway dogfooding proof should map to a Desktop-local equivalent:

| Gateway proof today      | Desktop proof later               |
| ------------------------ | --------------------------------- |
| Postgres memories        | SQLite local memories             |
| pgvector document chunks | local vector store chunks         |
| API style profile        | local style profile               |
| context preview endpoint | context preview panel             |
| provider router env vars | provider settings UI and keychain |
| audit logs               | local activity/safe logs          |
| markdown connector       | selected folder indexing          |

The future Desktop smoke path should show the same user story without Docker:

1. create a persona
2. choose a provider or local endpoint
3. add a preference memory
4. index a small folder
5. ask a question
6. inspect context preview
7. delete/export memory

## Dogfooding the Docs Themselves

Once you have run `seed-dogfooding.ps1`, ask the compiler about N0Tune:

```bash
curl -s -X POST http://localhost:8000/v1/context/preview \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "n0tune_dogfood",
        "message": "How does the context compiler decide what to include?"
      }'
```

You should see seeded positioning memory plus chunks from `docs/context-compiler.md`. That output proves the repo can use its own memory and context compiler.

## Headline Number

From [benchmarks.md](benchmarks.md), token-savings eval with the `two_user_personalization` scenario:

| Metric                  | Value        |
| ----------------------- | ------------ |
| Tokens saved per query  | about 236    |
| Tokens saved percent    | 17.4 percent |
| Compiled context tokens | about 1,118  |
| Naive baseline tokens   | about 1,354  |

Reproduce locally with:

```bash
python -m evals token_savings
```

The number is conservative because the eval uses the deterministic hash embedding backend so CI stays keyless.

## What This Does Not Cover Yet

- Desktop app behavior. Desktop is not implemented yet.
- Long conversations with history compression.
- Real LLM judge for answer quality.
- Native local Desktop storage.
- Provider settings UI and OS keychain handling.

## How to Extend This Loop

When you add a feature:

1. Write the test first where practical.
2. Make `smoke-mvp.ps1` exercise the new user-visible Gateway path.
3. If it changes selection quality, add or update an eval scenario.
4. Update this doc with what the loop now proves.

Principle: every product claim in the README should be reachable from a local proof path.
