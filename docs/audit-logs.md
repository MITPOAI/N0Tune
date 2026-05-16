# Audit logs

N0Tune records every mutation through an audit log. The point isn't
forensic completeness; it's "did this memory disappear because a human
deleted it, or because something went wrong?"

## What gets logged

The current audit surface covers data mutations and API-key management.
Read endpoints are intentionally **not** audited — they would dwarf the
write log and we don't have a current use case for it.

| Action               | Resource type | Notes                                          |
| -------------------- | ------------- | ---------------------------------------------- |
| `memory.create`      | `memory`      | Records `type` and initial `confidence`        |
| `memory.update`      | `memory`      | Records which fields changed                   |
| `memory.delete`      | `memory`      | Soft or hard via `metadata.hard`               |
| `document.create`    | `document`    | Records `title` and `chunk_count`              |
| `document.delete`    | `document`    | Soft or hard via `metadata.hard`               |
| `api_key.create`     | `api_key`     | Records `name`, `role`, `key_prefix`           |
| `api_key.revoke`     | `api_key`     | Records `key_prefix`                           |

The schema lives in
[`apps/api/alembic/versions/20260517_0002_permissions_and_audit.py`](../apps/api/alembic/versions/20260517_0002_permissions_and_audit.py)
and mirrors what's in the global database design.

## Row shape

```json
{
  "id": "aud_3f...",
  "app_id": "demo",
  "actor_user_id": "user_42",
  "actor_role": "developer",
  "action": "memory.create",
  "resource_type": "memory",
  "resource_id": "mem_88...",
  "metadata_json": {
    "type": "preference",
    "confidence": 0.92
  },
  "created_at": "2026-05-17T03:12:08+00:00"
}
```

- `actor_user_id` is the user the action was *for*, not the human or
  service running the request. For memory writes this is the
  `payload.user_id`. For document writes there is no end-user, so this
  is null.
- `actor_role` is the role of the API key that authenticated the
  request. `null` means anonymous (only possible when the API runs
  with `N0TUNE_REQUIRE_API_KEY=false` and no key was supplied).
- `metadata_json` is a free-form JSON object. We add small, useful
  facts (chunk counts, hard vs. soft, field names) but never the
  full payload — that would defeat redaction.

## Reading the log

```bash
curl -s "http://localhost:8000/v1/audit-logs?app_id=demo&resource_type=memory" \
  -H "Authorization: Bearer replace-with-local-development-key" | jq
```

Supported query parameters:

- `app_id` (required, defaults to `demo`)
- `resource_type` — `memory`, `document`, or `api_key`
- `action` — exact match, e.g. `memory.delete`
- `limit` — 1–500, defaults to 100, ordered by `created_at DESC`

Reading the audit log requires the `admin` role — see
[permissions.md](permissions.md).

## Retention

There's no automatic retention. The table grows with each write. If
that becomes a problem:

1. Add a periodic `DELETE FROM audit_logs WHERE created_at < ...` job.
2. Mirror to S3 or another long-term store before deleting.

We deliberately ship without that policy so projects can pick the
retention model that fits their compliance posture.

## Privacy

`actor_user_id`, `resource_id`, and `metadata_json` may contain
identifiers that map to real end-users. Treat the table the same way
you would treat application logs:

- Don't expose it to viewers (the role check enforces this).
- Don't ship it to third-party log aggregators unredacted.
- When a user requests data deletion, delete their audit rows along
  with their memories. A simple `WHERE actor_user_id = ?` query plus
  resource-id sweeps does the job.

## What this is not

- Not a tamper-evident log. Rows can be edited by anyone with database
  access. If you need tamper-evidence, mirror to an append-only store.
- Not a per-request request log. Read paths and provider calls are
  audited via structured application logs and Langfuse traces (see
  [observability.md](observability.md)).
- Not the place to track context-compiler decisions. Those live in the
  `context_runs` table — see [context-compiler.md](context-compiler.md).
