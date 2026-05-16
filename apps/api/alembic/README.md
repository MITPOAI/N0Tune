# Alembic migrations

Migrations live in `alembic/versions`.

Run locally from `apps/api`:

```powershell
..\..\.venv\Scripts\alembic upgrade head
```

The initial migration creates the Phase 1-7 MVP schema and enables `pgvector` on PostgreSQL.
