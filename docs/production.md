# Production deployment

A pragmatic guide for putting N0Tune in front of real users. For the
Kubernetes-specific manifests see [k8s.md](k8s.md); for an
operations-focused checklist see the section at the end of
[k8s.md](k8s.md#production-checklist). This doc covers the platform-neutral
decisions you make before you pick a deployment target.

## The minimum production surface

You need five things wired up:

1. **API service** (`apps/api`) — at least two replicas behind a load
   balancer so a node loss doesn't take you down.
2. **Postgres with pgvector** — managed (RDS, CloudSQL, Neon, Supabase) or
   operator-driven (CloudNativePG, Zalando). Enable the `vector` extension
   before running migrations.
3. **Redis** — managed Redis (ElastiCache, Memorystore, Upstash) is the
   easy path. Persistence with AOF for the semantic cache.
4. **Dashboard** (`apps/dashboard`) — optional; if you ship it, put it on a
   separate hostname so cookies and CSP don't accidentally bleed.
5. **Object storage** *(future)* — when the connector layer grows beyond
   Markdown, you'll want S3 / GCS for raw uploads. Not required today.

## Configuration

Every knob is an env var. The canonical list is `.env.example`. The variables
you must set in production:

| Var                              | What                                                | Notes                                                                  |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `N0TUNE_ENVIRONMENT`             | `production`                                        | Used in logs and headers.                                              |
| `N0TUNE_DATABASE_URL`            | Postgres connection string                          | Use a non-superuser role with `pgvector` already created.              |
| `N0TUNE_REDIS_URL`               | Redis connection string                             | Required for cache + rate limit.                                       |
| `N0TUNE_APP_API_KEY`             | The bootstrap **owner** key                         | Treat as a secret. Rotate by minting a new key via `/v1/api-keys`.     |
| `N0TUNE_REQUIRE_API_KEY`         | `true`                                              | **Always on in production.**                                            |
| `N0TUNE_RATE_LIMIT_RPM`          | Reasonable RPM (e.g. `300`)                         | Single replicas: any backend. Multi-replica: must be `redis`.          |
| `N0TUNE_RATE_LIMIT_BACKEND`      | `redis`                                             | See above.                                                              |
| `N0TUNE_PROVIDER_BASE_URL`       | Upstream OpenAI-compatible endpoint                 | OpenAI, Anthropic via a proxy, vLLM, or your own gateway.              |
| `N0TUNE_PROVIDER_API_KEY`        | Upstream provider credential                        | Per provider.                                                          |
| `N0TUNE_EMBEDDING_PROVIDER`      | `openai` or `fastembed`                             | The default `hash` backend is **dev only**.                            |
| `N0TUNE_EMBEDDING_OPENAI_API_KEY`| OpenAI-compatible embedding credential              | Required when `EMBEDDING_PROVIDER=openai`.                             |
| `N0TUNE_CORS_ORIGINS`            | Comma- or JSON-list of frontends                    | Don't ship `["*"]`.                                                    |

Anything below this line is optional but recommended:

- `N0TUNE_LANGFUSE_*` for observability.
- `N0TUNE_HYBRID_LEXICAL_WEIGHT=0.3` once you've validated lexical helps.

## Pre-deploy checklist

1. `pgvector` extension created in the production database.
2. Alembic migrations executed against production:
   `alembic -c apps/api/alembic.ini upgrade head`. Gate the API rollout on
   this job succeeding; see [`k8s.md`](k8s.md) for the Helm/Job pattern.
3. `N0TUNE_REQUIRE_API_KEY=true` and a bootstrap **owner** key is provisioned.
4. At least one non-owner key minted via `POST /v1/api-keys` for each
   downstream service. Treat the bootstrap key as a break-glass credential.
5. Embedding provider chosen and an end-to-end smoke run executed against
   prod-equivalent infra. Production with the `hash` backend works in the
   sense that no requests fail, but it ranks badly.
6. Rate-limit RPM picked based on expected upstream provider QPM.

## TLS and the streaming proxy

The OpenAI-compatible proxy supports SSE streaming. Make sure your ingress
**does not buffer the response**:

- ingress-nginx: `nginx.ingress.kubernetes.io/proxy-buffering: "off"` (set
  per-Ingress).
- Cloudflare: enable "Disable Response Buffering" or use a Workers proxy.
- ALB / NLB: TCP / HTTP/1.1 path-through is fine.
- nginx vanilla: `proxy_buffering off;` in the relevant `location` block.

Verify with:

```bash
curl -N -X POST https://api.example.com/v1/openai/chat/completions \
  -H "Authorization: Bearer <prod-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model>", "stream": true, "messages":[{"role":"user","content":"hi"}]}'
```

You should see `data: {...}` lines arrive progressively, terminating with
`data: [DONE]`.

## Logging

The API emits structured logs. Each request carries an
`X-Request-ID` header that you can correlate across the load balancer,
the API, and (optionally) Langfuse. Two things to scrub before piping logs
to an external aggregator:

- API keys (the API itself never logs keys; verify your own code does the
  same).
- Memory text. End-user memories are private by design.

A reasonable filter: redact any string matching `Bearer .*` or the
patterns in
[`apps/api/app/services/security/secrets.py`](../apps/api/app/services/security/secrets.py).

## Health endpoints

- `GET /health` — fast, cheap. Use for load-balancer liveness.
- `GET /health?deep=true` — checks Postgres and Redis reachability. Use
  for readiness, run no more than every 10s per replica to avoid hammering
  Postgres.

The dashboard reads `/health?deep=true` for its overview tab.

## Scaling primitives

Detailed playbook in [scaling.md](scaling.md). The short version:

- Stateless API: horizontal scale on CPU. Add replicas; rate-limit
  backend must be `redis`.
- Postgres: vertical scale first, read replicas later for analytics.
  Sharding is post-v1.
- Redis: a single primary with persistence is enough for the cache; add
  Sentinel or use a managed service for failover.

## Backups

Detailed playbook in [backup-restore.md](backup-restore.md). Don't skip
this — the semantic cache is rebuildable but memories and documents are
not.

## Observability

See [observability.md](observability.md) for the Langfuse integration. The
core signals worth alerting on:

- 5xx rate on `/v1/chat` — provider outage or N0Tune bug.
- Rate-limit 429 rate per app key — capacity planning.
- Postgres connection pool utilization.
- Embedding provider error rate (logged via the warning path).

## Upgrade strategy

- N0Tune is pre-1.0 SemVer: minor bumps may contain breaking changes.
  Read [CHANGELOG.md](../CHANGELOG.md) before bumping.
- Run Alembic before rolling new pods. New API pods will refuse to boot if
  migrations are pending; old pods keep serving until the new ones are
  ready.
- Roll back by re-pointing the image and running `alembic downgrade -1`
  against the database. Every migration in `apps/api/alembic/versions/`
  ships a `downgrade()` step.

## Deployment-specific security

Beyond what [security.md](security.md) covers:

- Run the API as a non-root user (the shipped Dockerfile already does).
- Drop all Linux capabilities you don't need. The API needs none.
- Pin image SHAs in production manifests; never use `:latest`.
- Network-policy the API to talk only to Postgres, Redis, and the
  provider URL.
- Rotate the bootstrap `N0TUNE_APP_API_KEY` quarterly. Revocation is
  immediate via `DELETE /v1/api-keys/{id}` once you've cut callers over to
  a fresh key.

## What this is **not**

- Not a Kubernetes-specific guide — see [k8s.md](k8s.md) for that.
- Not a Helm chart — none shipped yet. The manifest fragments in
  `k8s.md` are deliberately small enough to template by hand.
- Not a "managed N0Tune" service — N0Tune is self-hosted by design.
