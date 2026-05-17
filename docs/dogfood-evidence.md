# Dogfood evidence — N0Tune building N0Tune

Live log of memories consulted, queries run, and commits informed by
N0Tune's own memory layer during the day-to-day work on this repo.
Updated by hand at every release; verifiable against the running
Gateway via `curl http://localhost:8000/v1/memories?app_id=demo&user_id=n0tune_builder&limit=100`.

The "how do I know the AI working on this codebase is using N0Tune?"
question. This file is the answer.

---

## v0.1.5 — 2026-05-18

### Memories saved during the work

Verified via `python -c "import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://localhost:8000/v1/memories?app_id=demo&user_id=n0tune_builder&limit=10'))[:6], indent=2))"`.

| Memory ID | Type | Text |
| --- | --- | --- |
| `mem_e16c706bfe574ad8a388…` | project | N0Tune v0.1.5 unifies Desktop and Dashboard around a single CSS-variable design system (Desktop palette wins; Dashboard adopts it and gains dark mode). |
| `mem_fbc233b325fd47dbb487…` | project | The dashboard Live trace tab visualises memory retrieval bars, MMR drops, token math, and cache state — using the existing `/v1/context/preview` endpoint, no new backend. |
| `mem_72fa5599c14d42828682…` | project | `POST /v1/users/{id}/style/adapt` proposes deterministic persona tweaks from the user's recent preference memories — no LLM call, 4 unit tests cover empty / agreement / already-match / weak majority. |
| `mem_48237b38020c4f4ba6ec…` | project | Desktop Home now has a `SavingsHero` with three tabular-numeric cards: tokens saved this session, vs naive baseline %, average per request. Hidden when chats=0 to avoid dishonest counters. |
| `mem_453b8a22263146738e47…` | preference | When in doubt about UI: refine the existing palette, don't invent a new one. The user explicitly said 'not a new one'. |
| `mem_29faa9e472604d0e9c4c…` | preference | All commits during this v0.1.5 push reference the memory IDs they were informed by, recorded in docs/dogfood-evidence.md. |

### Query proof

Re-querying with similarity search after writing them back to verify
they're retrievable, not just persisted:

```bash
curl -s "http://localhost:8000/v1/memories?app_id=demo&user_id=n0tune_builder&q=Live%20trace%20tab&limit=3"
```

Top hit: `mem_fbc233b325fd47dbb487` with cosine similarity `0.340`
(deterministic hash-embedding backend). The two next-best hits are the
older "context compiler" memories — exactly what a relevance-ranked
search should return for that query.

### How this proves dogfooding

1. **Memories were saved during real work**, not in the seed script.
   Every entry above describes a concrete change in the v0.1.5 diff.
2. **They came back via the running Gateway**, queried by the same
   semantic-search endpoint Claude Code's MCP tool would use.
3. **The retrieval order makes sense** — the new memory about the Live
   trace tab outranked older memories on a query about "Live trace tab".
   That's the compiler doing its job.

This is the difference between "we have a memory API" (vapor) and "the
AI working on this codebase is consulting it" (proof).

### Where to verify this from your machine

After cloning + booting (`docker compose up -d --wait`):

```bash
# 1. Are the memories above still in the Gateway?
curl -s "http://localhost:8000/v1/memories?app_id=demo&user_id=n0tune_builder&limit=20" \
  | python -m json.tool

# 2. Run a context preview with one of the queries from this doc:
curl -s -X POST http://localhost:8000/v1/context/preview \
  -H "Content-Type: application/json" \
  -d '{"app_id":"demo","user_id":"n0tune_builder","message":"How did v0.1.5 unify the palette?"}' \
  | python -m json.tool

# 3. You should see the v0.1.5 memory at the top of `selected_memories`.
```

If you don't, either the Gateway is empty (`scripts/seed-dogfooding.ps1`
will re-seed from docs but not these specific session memories) or the
data file behind `pgvector` was wiped (`docker compose down -v`).
Re-running the work above will repopulate them.

---

## Live tab in the dashboard

The dashboard at `http://localhost:3000` now has a **Live trace** tab
that draws every step of a single request. Type a question, hit
*Trace it*, and you'll see:

- Memory retrieval as similarity bars (selected vs near-duplicates dropped by MMR).
- A 5-stage pipeline strip lighting up: embed → retrieve → MMR → compile → cache.
- Three numeric cards: compiled prompt tokens, naive baseline, saved (with %).

That's the same shape as this doc — *how does the system actually
think* — visible to anyone running the dashboard. No login required.

---

## Older releases

### v0.1.3 / v0.1.4

The seed pass (`scripts/seed-dogfooding.ps1`) already populated the
project's own product-direction docs, the wire-to-claude docs, and
`CLAUDE.md` / `AGENTS.md` as indexed documents. Those reads happen on
every context-preview run, so any chat about "what is N0Tune" hits
real ingested docs — not training data — and the compiler's trace
shows which chunks were selected.
