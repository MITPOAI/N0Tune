# Memory lifecycle

N0Tune memories are not write-once. They have states, confidence, and a decay
function so the compiler can prefer fresh, confirmed facts over stale
inferences. This page documents what's implemented today and what's
deliberately deferred.

## States

```
candidate → active → confirmed
                 \-→ deprecated
                 \-→ conflicted
                 \-→ expired
                 \-→ deleted
```

| State        | When the row enters this state                                                | Retrievable? |
| ------------ | ------------------------------------------------------------------------------ | :----------: |
| `candidate`  | The auto-extractor pulled this from a chat. Not yet confirmed.                | ✓            |
| `active`     | Default for user-created and extractor-validated memories.                    | ✓            |
| `confirmed`  | The user (or a tool) called `POST /v1/memories/{id}/confirm`. Decay pins out. | ✓            |
| `deprecated` | Superseded by another memory; ``replaced_by_memory_id`` points at the heir.   | ✗            |
| `conflicted` | The extractor saw a contradiction it couldn't resolve.                        | ✗            |
| `expired`    | Past `expires_at`.                                                            | ✗            |
| `deleted`    | Soft-deleted via the `DELETE` endpoint.                                       | ✗            |

The retrievable set is enforced by
[`is_retrievable`](../apps/api/app/services/memory/lifecycle.py); the context
compiler honours it. Non-retrievable rows still appear in `GET /v1/memories/export`.

## Confidence and decay

Every memory has a `confidence` in `[0, 1]`. The compiler scores each memory
by `cosine_similarity × max(effective_confidence, 0.05)` where
`effective_confidence` is:

- `confidence` when the state is `confirmed` (no decay applied).
- `confidence × exp(-age_days × ln(2) / half_life_days)` otherwise.

The age clock is anchored to `last_confirmed_at`, then `last_used_at`, then
`updated_at` — whichever is latest. So:

- A confirmed memory keeps its weight indefinitely.
- An active memory that the compiler keeps picking stays warm because
  `last_used_at` resets the clock.
- An active memory nobody uses fades over `half_life_days` (default 60).

The half-life is currently a constant. If you want to expose it as a config,
patch [`apps/api/app/services/memory/lifecycle.py`](../apps/api/app/services/memory/lifecycle.py)
— it is a single argument.

## Lifecycle endpoints

Beyond plain CRUD, the API ships these:

```bash
# Confirm a memory (state -> confirmed, last_confirmed_at = now)
curl -X POST "http://localhost:8000/v1/memories/<id>/confirm?app_id=demo" \
  -H "Authorization: Bearer replace-with-local-development-key"

# Export every memory for a user, including soft-deleted and deprecated rows
curl "http://localhost:8000/v1/memories/export?app_id=demo&user_id=alice" \
  -H "Authorization: Bearer replace-with-local-development-key"
```

`export` is intended for end-user data requests. It bypasses the
`is_retrievable` filter and surfaces every row tied to the user.

## What this is **not**

- Not a full lifecycle engine. We don't auto-detect duplicates or
  contradictions yet; that work belongs to the extractor pass in
  [`docs/dogfooding.md`](dogfooding.md). The schema fields
  (`replaced_by_memory_id`, `version`, `state=conflicted`) are present so the
  extractor can land without another migration.
- Not a background job. Decay applies at read time; nothing rewrites the row.
  Decision: avoids stale-by-async-job bugs. Trade-off: a memory that was used
  six months ago needs a recalculation each retrieval.
- Not an approval workflow. The `approval_mode` knob in the spec (auto /
  review / manual) is documented but not wired. When we wire it, the
  extractor will create rows as `candidate` if `review` or `manual` is set
  and promote on user action.

## Tests

[`apps/api/app/tests/test_memory_lifecycle.py`](../apps/api/app/tests/test_memory_lifecycle.py)
covers:

- `is_retrievable` excludes deleted / deprecated / expired memories.
- Decay weakens older memories.
- `confirmed` pins confidence past the half-life.
- `POST /v1/memories/{id}/confirm` updates state and timestamp.
- `GET /v1/memories/export` returns soft-deleted rows.
- `last_used_at` is stamped when the compiler selects a memory.
- App-scoped memories are visible across users in the same app; user-scoped
  memories are not.

The cache-freshness regression that surfaced when we first wired
`last_used_at` is the reason `memories.updated_at` no longer has an
`onupdate=now_utc` ORM hook — see the comment on the column.
