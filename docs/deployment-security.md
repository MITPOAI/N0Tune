# Deployment security

Security choices that live at the deployment layer, not inside the app. For
the application's threat model (prompt injection, multi-tenant isolation,
memory secret scanning) see [security.md](security.md). For RBAC and
audit see [permissions.md](permissions.md) and [audit-logs.md](audit-logs.md).

## Network

- **Force HTTPS.** N0Tune does not redirect or HSTS by itself; do it at
  the ingress.
- **Restrict egress.** The API needs to reach Postgres, Redis, and your
  configured `N0TUNE_PROVIDER_BASE_URL` / `N0TUNE_EMBEDDING_OPENAI_BASE_URL`.
  Block everything else with a NetworkPolicy or VPC firewall.
- **Block public access to Postgres and Redis.** Even if they're cloud-
  managed, scope their inbound rules to the API's security group/subnet.
- **CORS.** Set `N0TUNE_CORS_ORIGINS` to the exact frontend hosts. Never
  ship `["*"]`.

## Secrets

- **Never bake secrets into images.** Use env vars sourced from a secrets
  manager. The k8s guide ([k8s.md](k8s.md)) wires External Secrets
  Operator; pick the equivalent on your platform.
- **API keys are hashed at rest** by N0Tune. Stay out of the
  `apps.api_key_hash` and `api_keys.key_hash` columns — they exist only
  for verification.
- **Rotate the bootstrap owner key** quarterly. Create the replacement via
  `POST /v1/api-keys`, cut callers over, then `DELETE /v1/api-keys/{id}`
  for the old one.
- **CI secrets.** The GitHub Actions workflow uses Gitleaks CLI rather
  than `gitleaks/gitleaks-action@v2` because the action requires a paid
  license on organization repos. Confirm no other workflow file ships a
  secret. See [security.md#secret-scanning-in-ci](security.md#secret-scanning-in-ci).

## Authentication

- `N0TUNE_REQUIRE_API_KEY=true` in production. Without it, requests with
  no API key get anonymous access (an `actor_role` of `None`) — fine for
  local dev, dangerous in production.
- Provision separate API keys per downstream service so revocation is
  granular and audit logs are attributable.
- For the OpenAI-compatible proxy, prefer minting a `developer` key per
  consumer rather than handing out the bootstrap `owner` key.

## Logging and redaction

- The API never logs API keys. If you add custom middleware, mirror the
  redaction patterns in
  [`apps/api/app/services/security/secrets.py`](../apps/api/app/services/security/secrets.py).
- The audit log stores `actor_role` and `actor_user_id`, not the raw
  bearer token. Don't add the token to `metadata_json`.
- When shipping logs to a third-party aggregator, strip:
  - `Authorization` header values.
  - Any string matching the secret-detector patterns.
  - Memory `text` fields. These belong to end-users.

## Container hardening

- Run as a non-root user. The shipped Dockerfiles already do.
- Drop Linux capabilities. The API needs no capabilities; the dashboard
  needs none either.
- Pin image SHAs in production manifests. `image: ghcr.io/your-org/n0tune-api@sha256:...`.
- Scan images with Trivy / Grype before promoting them. Resolve `HIGH` and
  above before going live.
- Keep `apps/api/Dockerfile`'s base image current — Python security
  patches ship via the base.

## Dependency hygiene

- CI runs `pip-audit` and `npm audit` on every PR
  (`.github/workflows/ci.yml`). Treat `high` and `critical` findings as
  release blockers.
- Dependabot is recommended. We do not ship a `.github/dependabot.yml`
  yet because the cadence depends on team preference.

## Streaming and rate limiting at the edge

- Disable response buffering on the ingress for `/v1/openai/chat/completions`
  when `stream: true` is in use. Buffered streams collapse into a single
  client receipt and defeat the purpose. ingress-nginx annotation:
  `nginx.ingress.kubernetes.io/proxy-buffering: "off"`.
- Edge rate limiting (Cloudflare, AWS WAF, NGINX `limit_req`) is a useful
  layer **in front of** N0Tune's rate limiter. They protect against
  abusive single-IP traffic before requests reach your app.

## Incident response

- The audit log is your first stop. Filter by `resource_type` and
  `action` to reconstruct a timeline.
- Revoke compromised keys immediately via
  `DELETE /v1/api-keys/{id}`. The lookup happens on every request, so the
  next call from a revoked key is rejected immediately.
- If the bootstrap owner key (`N0TUNE_APP_API_KEY` env) is suspected:
  1. Mint a fresh owner-role key via the API.
  2. Update `N0TUNE_APP_API_KEY` in the secret store and roll the API.
  3. Revoke the old key. (Soft-revoke via the API row plus rotating the env
     var leaves no overlap window.)
- For database compromise scenarios, refer to [backup-restore.md](backup-restore.md#disaster-scenarios).

## What this is **not**

- Not an exhaustive checklist. Pair this with your platform's own
  hardening guide.
- Not a substitute for an external pen test. We recommend one before any
  multi-tenant production launch.
- Not a compliance certification. SOC2, ISO 27001, GDPR posture, etc. are
  your responsibility — N0Tune ships the audit log and secret-rejection
  primitives you'll need to demonstrate them.
