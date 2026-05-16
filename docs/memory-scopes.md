# Memory scopes

Every memory carries a `scope` field. Today's MVP supports seven labels:

```
global, app, org, team, project, user, session
```

The compiler treats them as a simple visibility ladder, not an isolation
boundary in the SQL sense. Users in the same `app_id` can see each other's
**non-user** scoped memories; they cannot see each other's `user`-scoped
memories.

## What's enforced today

In [`apps/api/app/services/context/compiler.py`](../apps/api/app/services/context/compiler.py),
context retrieval pulls memories where:

```sql
app_id = ?               -- always enforced
AND ( user_id = ?        -- the requesting user's private memories
      OR scope IN ('global', 'app', 'org', 'team', 'project') )
```

So:

- `scope=user` (default) — private to the user. Other users in the app cannot
  retrieve it.
- `scope=session` — also private to the user; we treat session memories as
  user-scoped at retrieval time because session boundaries are not first-class
  yet (see "what is not implemented" below).
- `scope=global` / `app` / `org` / `team` / `project` — visible to every user
  in the app. The labels are stored verbatim so downstream consumers
  (dashboard, audit log) can distinguish them, but the compiler treats them
  identically.

## Writing a non-user scope

```bash
curl -X POST http://localhost:8000/v1/memories \
  -H "Authorization: Bearer replace-with-local-development-key" \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "team_writer",
        "type": "project",
        "text": "Team rule: prefer ADRs for design decisions.",
        "confidence": 0.95,
        "scope": "team"
      }'
```

Any other user in `demo` who then asks the compiler something relevant
will see that memory show up in `selected_memories`. The user-scoped
analogue stays private.

## Hierarchy intent

The full spec ranks scopes top-down:

```
system / security rules     (compiler-injected, not a memory row)
app / developer rules       (app-scoped memory)
org / team / project        (shared memory)
user                        (private memory)
session                     (per-session memory)
retrieved documents         (RAG chunks)
cached answers              (semantic cache)
```

The current compiler implements only "user vs shared." The richer ranking
lands when the prompt builder weights memories differently by scope; that's
a one-line change in the scoring step, deferred until we have user requests
asking for it.

## What is **not** implemented

- No `orgs` or `teams` tables. Scope is a label on the memory row, not a
  foreign key. If you need real multi-org isolation, model each org as its
  own `app_id` — that boundary **is** enforced everywhere.
- No `sessions` table. `scope=session` is treated as `scope=user` at
  retrieval; we keep the label so future session-bounded retrieval can land
  without a migration.
- No scope-based permission rules. The role-based permission system
  ([permissions.md](permissions.md)) gates *who* can read/write memories.
  Scopes only filter *which* memories show up in context retrieval.

## Tests

[`apps/api/app/tests/test_memory_lifecycle.py`](../apps/api/app/tests/test_memory_lifecycle.py)
covers two scope invariants:

- `test_app_scope_memory_is_visible_to_other_users_in_same_app`
- `test_user_scope_memory_stays_private_across_users`

Multi-app isolation is independently tested in
[`test_api_mvp.py`](../apps/api/app/tests/test_api_mvp.py) and is not
relaxed by scopes — different `app_id`s never see each other.
