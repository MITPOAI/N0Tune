# Testing

What "tests pass" means in this repo, and how to run each piece locally.

## TL;DR

```bash
# Python - Core + API + SDK + LangChain + LlamaIndex
pytest packages/core/tests
pytest apps/api/app/tests
pytest packages/sdk-py/tests
pytest integrations/langchain/tests
pytest integrations/llamaindex/tests

# Lint + typecheck
ruff check packages/core apps/api packages/sdk-py integrations/langchain integrations/llamaindex
mypy packages/core/src apps/api/app packages/sdk-py/src integrations/langchain/src integrations/llamaindex/src

# Node - all workspaces
npm test
npm run typecheck
npm run lint
npm run build

# End-to-end smoke (requires `docker compose up`)
pwsh scripts/smoke-mvp.ps1
```

## Layered Test Surface

| Layer              | Path                                | What it covers                                                                                              |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Core unit          | `packages/core/tests/`              | Token estimation, lexical scoring, security scans, and compiled-context formatting.                         |
| API unit + route   | `apps/api/app/tests/`               | Memory/style/document CRUD, context preview, chat, OpenAI proxy, semantic cache, rate limit, Langfuse stub. |
| Python SDK         | `packages/sdk-py/tests/`            | Outbound HTTP shapes via `httpx.MockTransport`.                                                             |
| LangChain          | `integrations/langchain/tests/`     | `N0TuneRetriever` and `N0TuneMemoryStore` against a mocked SDK transport.                                   |
| LlamaIndex         | `integrations/llamaindex/tests/`    | Same shape, against the LlamaIndex `BaseRetriever`/`NodeWithScore` contract.                                |
| JS SDK             | `packages/sdk-js/tests/`            | SDK metadata + request building with a stubbed `fetch`.                                                     |
| MCP server         | `integrations/mcp-server/tests/`    | Tool list + I/O shape of the stdio server.                                                                  |
| Vercel AI SDK      | `integrations/vercel-ai-sdk/tests/` | Provider factory points at `/v1/openai`, system-prompt helper returns `compiled_context`.                   |
| Dashboard unit     | `apps/dashboard/tests/`             | Page rendering with Vitest.                                                                                 |
| Dashboard e2e      | `apps/dashboard/e2e/`               | Playwright flows against a live `docker compose` stack.                                                     |
| End-to-end smoke   | `scripts/smoke-mvp.ps1`             | Curl-style flow that exercises health, memory, style, docs, context preview, chat, and cache.               |
| Phase-0 invariants | `scripts/check-phase0.ps1`          | Required files and Compose config validation.                                                               |
| MVP invariants     | `scripts/check-mvp.ps1`             | Schema, migrations, presence of the v0.1 endpoints, Core checks, and Gateway checks.                        |

## API Tests

```bash
python -m pip install -e "packages/core[dev]"
python -m pip install -e "apps/api[dev]"
pytest apps/api/app/tests
```

Tests run against an in-memory SQLite engine wired up in
[`apps/api/app/tests/conftest.py`](../apps/api/app/tests/conftest.py). The
`client` fixture overrides `get_session` to use that engine; the
`session_factory` fixture is exposed so individual tests can read or write
state directly (used by the hardening suite for cache TTL and ContextRun
audit checks).

Helpful subsets:

```bash
pytest apps/api/app/tests/test_api_mvp.py        # original MVP route tests
pytest apps/api/app/tests/test_hardening.py      # cache TTL, soft-delete, injection, rate limit, real provider
pytest apps/api/app/tests/test_health.py         # basic + deep health
```

## End-To-End Smoke

`scripts/smoke-mvp.ps1` is the closest thing we have to "is the system actually wired up?" It assumes the Docker Compose stack is already running.

```powershell
docker compose up -d --wait
pwsh scripts/smoke-mvp.ps1
```

The script exercises:

1. `GET /health?deep=true`: DB and Redis must be reachable.
2. `POST /v1/memories` and `GET /v1/memories?...`: secret-detection rejects the planted bad payload; the safe one round-trips.
3. `PATCH /v1/users/{user_id}/style`: style profile merge.
4. `POST /v1/documents`: chunking and injection-risk scoring.
5. `POST /v1/context/preview`: selects the seeded memory and chunks.
6. `POST /v1/chat`: first call misses cache, second call hits it.
7. `GET /v1/cache?...` and `DELETE /v1/cache?...`: list and clear.

Each step uses a fresh `user_id` (`n0tune_smoke_<timestamp>`) so reruns do not collide.

The same flow translated to `curl` for one-off poking:

```bash
# 1. health
curl -s http://localhost:8000/health | jq

# 2. create a memory
curl -s -X POST http://localhost:8000/v1/memories \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "user_1",
        "type": "preference",
        "text": "User prefers concise architecture answers.",
        "confidence": 0.92
      }' | jq

# 3. context preview
curl -s -X POST http://localhost:8000/v1/context/preview \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "user_1",
        "message": "Explain RAG like before",
        "max_context_tokens": 1200
      }' | jq

# 4. chat (first call seeds cache)
curl -s -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
        "app_id": "demo",
        "user_id": "user_1",
        "message": "Explain RAG like before"
      }' | jq

# 5. multi-tenant isolation: user_b cannot see user_1's memory
curl -s "http://localhost:8000/v1/memories?app_id=demo&user_id=user_b"
# -> []
```

## Dashboard

```bash
npm --workspace apps/dashboard run typecheck
npm --workspace apps/dashboard run lint
npm --workspace apps/dashboard test       # vitest, fast
```

Manual dashboard product-demo check:

1. Start the stack with `docker compose up -d --wait`.
2. Open `http://localhost:3000`.
3. Open `Context Lab`.
4. Keep or edit the User A and User B ids.
5. Click `Seed demo`.
6. Confirm both side-by-side panels show selected memories, selected docs, compiled context, token estimate, token savings, warnings, and trace entries.

Context Lab intentionally uses `/v1/context/preview` only. It should not display a fabricated assistant answer.

Playwright e2e needs the full stack:

```bash
docker compose up -d --wait
npx --workspace apps/dashboard playwright install --with-deps chromium
npm --workspace apps/dashboard run test:e2e
```

The Playwright suite hits the live dashboard at `http://localhost:3000` and the API at `http://localhost:8000`. CI runs this as the `e2e` job. See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Secret Scanning

Locally:

```bash
# Install once.
go install github.com/zricethezav/gitleaks/v8@latest
# OR download the binary from the gitleaks releases page.

gitleaks detect --source . --redact --verbose
```

CI runs the same command via Gitleaks' CLI, not the action. The action requires a paid `GITLEAKS_LICENSE` secret on organization-owned repositories and silently fails for forks; the CLI does not. See [`.github/workflows/security.yml`](../.github/workflows/security.yml).

If you are running N0Tune in an organization that has purchased a Gitleaks license, you may swap in `gitleaks/gitleaks-action@v2` with the secret configured. The CLI workflow is documented as the supported default.

## Dependency Audit

```bash
python -m pip install pip-audit && pip-audit
npm audit --omit=dev --audit-level=high
```

These run in CI but tolerate failures (`continue-on-error: true`) so a single upstream advisory does not block every PR. Treat high and critical findings as release blockers regardless.

## Adding A New Test

1. Pick the smallest layer that covers the change: unit, route, then smoke.
2. Use the existing fixtures. Do not spin up a new in-memory engine when the `client` and `session_factory` fixtures already exist.
3. Name the test for the behavior, not the function: `test_cache_ttl_expiration_forces_miss`, not `test_lookup_cache`.
4. If the test boots Docker, gate it behind a marker or an env flag so `pytest` defaults stay fast.

## What Is Not Covered Yet

- Real Postgres + pgvector: in-memory SQLite is used for tests. The schema works on both because `pgvector.sqlalchemy` falls back when the `vector` extension is unavailable, but query plans differ.
- Real OpenAI / Anthropic providers: the mocked provider test in `test_hardening.py` exercises the wire format; live provider tests are intentionally absent to keep CI keyless.
- Production load / latency benchmarks: a methodology and headline numbers doc lives at [docs/token-savings-report.md](token-savings-report.md). A full eval harness lands alongside `evals/`.
