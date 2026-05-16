# Permissions

N0Tune has a small role-based permission system. Four roles, one permission
matrix, two key shapes.

## Roles

In strict order from weakest to strongest:

```
viewer < developer < admin < owner
```

| Role        | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `viewer`    | Read-only access. Sees memories, docs, context previews.   |
| `developer` | Adds memories and docs; cannot delete or manage keys.      |
| `admin`     | Reads audit logs; deletes memories and docs.               |
| `owner`     | Creates and revokes API keys. Full read/write/delete.      |

A higher role implies every lower role's permissions. There is no per-resource
ACL — the goal is one obvious rule per operation.

## Permission matrix

| Operation               | Minimum role |
| ----------------------- | ------------ |
| Read memory             | `viewer`     |
| Write memory            | `developer`  |
| Delete memory           | `admin`      |
| Read document           | `viewer`     |
| Write document          | `developer`  |
| Delete document         | `admin`      |
| View context trace      | `viewer`     |
| Manage API keys         | `owner`      |
| Read audit logs         | `admin`      |

The enum lives in
[`apps/api/app/services/security/permissions.py`](../apps/api/app/services/security/permissions.py).

When a request arrives, the route extracts the actor's role from the API key
that authenticated it and calls `require_permission(role, Permission.X)`.
Insufficient role returns `403` with a JSON body that names the permission and
the required role:

```json
{
  "detail": {
    "message": "Insufficient role for this operation.",
    "permission": "memory.delete",
    "required_role": "admin",
    "actor_role": "developer"
  }
}
```

## Authentication shapes

There are two ways to present credentials. Both produce a role.

### Legacy single key (backward compat)

`N0TUNE_APP_API_KEY` from the environment becomes the canonical key for the
auto-created `demo` app. Authenticating with that key gives you the **owner**
role. This is the simplest local-dev path and matches every example in the
README and docs.

### Multi-key (production shape)

You can mint additional keys per app, each with its own role:

```bash
curl -X POST http://localhost:8000/v1/api-keys \
  -H "Authorization: Bearer replace-with-local-development-key" \
  -H "Content-Type: application/json" \
  -d '{ "app_id": "demo", "name": "ci-developer", "role": "developer" }'
```

The response contains a one-time `plaintext` field. **Save it now** — N0Tune
never shows it again; only the hash is stored. The same response also has a
`key_prefix` (first 12 chars) you can use to recognize the key in lists and
audit logs without exposing the secret.

List keys (no plaintext, ever):

```bash
curl -s http://localhost:8000/v1/api-keys?app_id=demo \
  -H "Authorization: Bearer replace-with-local-development-key" | jq
```

Revoke a key (soft — sets `revoked_at`; subsequent auth attempts fail):

```bash
curl -X DELETE "http://localhost:8000/v1/api-keys/<key_id>?app_id=demo" \
  -H "Authorization: Bearer replace-with-local-development-key"
```

## How key lookup works

1. The middleware reads `Authorization: Bearer <token>` or
   `X-N0Tune-API-Key: <token>`.
2. `authorize_app` hashes the token and compares it to:
   - `apps.api_key_hash` (legacy) → role `owner`
   - `api_keys.key_hash` (multi-key) → role from `api_keys.role`, only if
     `revoked_at` is null
3. The first match wins. On match, `last_used_at` is updated on the
   matching `api_keys` row.

## Operational notes

- Keys are stored hashed (`sha256("n0tune:v1:" || plaintext)`). N0Tune
  cannot recover the plaintext if you lose it.
- Rotation is "create a new key, switch callers, then revoke the old one."
  We don't ship a dedicated rotate endpoint to keep the surface small.
- API keys are app-scoped, not user-scoped. A `developer`-role key can
  write memories for any user belonging to that app. If you need
  per-user scoping, model each end-user as a separate `app_id`.

## What this is not

- Not a full IAM system. There are no groups, no inheritance beyond the
  four-step role ladder, no time-bound policies.
- Not a replacement for transport security. Run the API behind TLS.
- Not a substitute for [`docs/security.md`](security.md) — secret
  detection, prompt-injection scoring, and multi-tenant scoping all still
  apply.
