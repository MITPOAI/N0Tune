# Backup and restore

What to back up, how often, and how to restore. The semantic cache and the
context-run audit are rebuildable; everything else is not. Plan accordingly.

## Backup tiers

| Tier | Data                                                         | Backup it? | Rebuild cost                                                                 |
| ---- | ------------------------------------------------------------ | :--------: | ---------------------------------------------------------------------------- |
| 1    | `memories`, `style_profiles`, `documents`, `document_chunks` | **Yes**    | Cannot rebuild without the original conversations + ingested source files.   |
| 2    | `apps`, `users`, `api_keys`, `audit_logs`                    | **Yes**    | Recoverable in principle but very disruptive to users.                       |
| 3    | `context_runs`                                               | Optional   | Lossless to lose; this is a trace, not a record. Keep if compliance demands. |
| 4    | `semantic_cache`                                             | **No**     | Rebuilds on first read after invalidation. Backing it up is wasted bytes.    |
| 5    | Redis state outside `semantic_cache` (rate-limit counters)   | **No**     | Resets to zero on next request.                                              |

## Postgres backups

Use whatever your platform recommends:

- **Managed Postgres** (RDS, CloudSQL, Neon, Supabase): turn on automated
  daily snapshots and 7+ day retention. Tag your retention policy to match
  your privacy commitment to users.
- **Self-managed via an operator** (CloudNativePG, Zalando): both ship
  built-in WAL archiving + Barman/pg_backrest. Configure off-site storage
  (S3, GCS, Azure Blob) and verify the first restore.
- **Self-managed without an operator**: run `pg_dump` nightly and ship
  the dumps off-host. Sample command:

  ```bash
  pg_dump \
    --format=custom --no-owner --no-privileges \
    --exclude-table=semantic_cache \
    --file="n0tune-$(date -u +%Y%m%dT%H%M%S).dump" \
    "$N0TUNE_DATABASE_URL"
  ```

  We exclude `semantic_cache` to keep dumps small; it rebuilds itself.

## Test the restore

Backups you haven't restored from are wishful thinking. Quarterly:

1. Provision a scratch Postgres instance.
2. Restore the latest dump:

   ```bash
   createdb n0tune_restore
   pg_restore --no-owner --dbname=n0tune_restore <latest>.dump
   ```

3. Run `alembic upgrade head` against the restored database — migrations
   are idempotent, so a no-op confirms schema parity.
4. Point a staging API at the restored database and run
   `scripts/smoke-mvp.ps1`. Healthy round-trip on memory create, list,
   context preview, and chat means the restore is good.
5. Document the elapsed time and shred the scratch instance.

## Redis

Don't bother backing up Redis for N0Tune's purposes.

- The semantic cache is, by design, a sacrificial layer. Wipe it without
  warning.
- The rate-limit counters expire on their own and reset gracefully when
  Redis comes back.

If you run Redis in cluster mode and use AOF + RDB persistence for other
workloads, leave that alone — N0Tune is happy with whatever you already
have.

## End-user data deletion

When a user requests deletion of their data:

1. **Memories** — bulk-soft-delete via:

   ```sql
   UPDATE memories SET deleted_at = now()
   WHERE app_id = $1 AND user_id = $2 AND deleted_at IS NULL;
   ```

   Or hard-delete:

   ```sql
   DELETE FROM memories WHERE app_id = $1 AND user_id = $2;
   ```

2. **Style profile** — `DELETE FROM style_profiles WHERE app_id = $1 AND user_id = $2;`
3. **Cache** — `DELETE FROM semantic_cache WHERE app_id = $1 AND user_id = $2;`
4. **Context runs** — `DELETE FROM context_runs WHERE app_id = $1 AND user_id = $2;`
5. **Audit logs** — `DELETE FROM audit_logs WHERE app_id = $1 AND actor_user_id = $2;`

Backups will retain the user's data until the dumps roll off. Document
your retention policy and your dump-rotation cadence so users know how long
their data lingers in cold storage.

## Disaster scenarios

### Primary database is gone

1. Provision a new Postgres instance.
2. Restore the most recent dump (or operator snapshot).
3. Update `N0TUNE_DATABASE_URL` and roll the API.
4. Document the data loss interval in your incident write-up.
5. Notify users if your retention policy requires it.

### Redis is gone

Restart Redis. The cache repopulates as queries arrive. Rate-limiting
counters reset, briefly allowing more requests through; this is acceptable.

### Postgres is intact but `vector` extension was dropped

Symptoms: API boots, but `embed_text` storage fails with column-type errors.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER EXTENSION vector UPDATE;
```

Then re-run `alembic upgrade head`. No data loss.

## What this is **not**

- Not a compliance checklist. Your auditor will care about retention
  duration, encryption at rest, encryption in transit, and access logging
  — work that lives outside this doc.
- Not a high-availability guide. See [scaling.md](scaling.md) for the
  HA primitives.
- Not a snapshot strategy. The pg_dump pattern above is the floor, not
  the recommendation. Use your platform's snapshot tooling whenever
  possible.
