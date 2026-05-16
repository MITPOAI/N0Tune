# Changelog

All notable changes to N0Tune will be documented here.

## Unreleased

### Added

- LangChain integration package at `integrations/langchain/` (`pip install n0tune-langchain`). Ships `N0TuneRetriever(BaseRetriever)` that calls `/v1/context/preview` and returns memories + chunks as `langchain_core.documents.Document` (with `metadata.kind` of `"memory"` or `"chunk"`), plus an `N0TuneMemoryStore` helper for save/search/forget. Wired into CI.
- LlamaIndex integration package at `integrations/llamaindex/` (`pip install n0tune-llamaindex`). Ships `N0TuneRetriever(BaseRetriever)` returning `NodeWithScore` objects with similarity-scored memories and chunks, plus the same `N0TuneMemoryStore` helper. Wired into CI.
- Vercel AI SDK integration package at `integrations/vercel-ai-sdk/` (`@n0tune/vercel-ai-sdk`). `createN0TuneProvider()` returns an `@ai-sdk/openai` provider pointed at N0Tune's OpenAI-compatible `/v1/openai` endpoint (streaming, tool use, etc. work unchanged). `buildN0TuneSystemPrompt()` returns the compiled context as a system prompt for use with other Vercel AI SDK providers. `createN0TuneClient()` re-exports the standard `@n0tune/sdk` client.
- Optional Langfuse observability in `services/observability/langfuse.py`, wired into `POST /v1/chat` and `POST /v1/context/preview`. Each event records `app_id`, `user_id`, `request_id`, model, cache hit, token estimates, and the ids of selected memories and chunks. Enabled when `N0TUNE_LANGFUSE_PUBLIC_KEY` and `N0TUNE_LANGFUSE_SECRET_KEY` are set and the `langfuse` package is installed (added as an optional extra). Fail-open: missing package, missing keys, or a Langfuse exception all leave the request path untouched.
- `docs/observability.md` covering enablement, trace shape, fail-open guarantees, and how to swap in a different tracing backend.
- Python SDK at `packages/sdk-py/` (`pip install n0tune`). Synchronous `httpx`-based client with typed `pydantic` v2 models. Exposes resource namespaces `memories`, `style`, `documents`, `context`, `chat`, `cache`, plus a `health()` helper. Non-2xx responses raise `N0TuneError` carrying the status code and decoded body. Wired into CI alongside the API tests.
- `docs/k8s.md` — a Kubernetes deployment guide covering Postgres + pgvector (CloudNativePG / Zalando), Redis, API/dashboard `Deployment`+`Service`+`Ingress`, External Secrets Operator wiring, the Alembic migration `Job`, and a production checklist. Includes the streaming-friendly ingress annotation.
- Playwright dashboard e2e suite at `apps/dashboard/e2e/`. Scenarios cover memory creation, style profile update, document indexing + context preview (verifying the `tokens_saved_estimated` field renders), and clearing the semantic cache. Wired into CI as a new `e2e` job that boots the Docker Compose stack and waits for `/health` before running the tests; the Playwright HTML report is uploaded as an artifact.
- Pluggable embedding provider in `services/context/embedding.py`. `N0TUNE_EMBEDDING_PROVIDER` selects between the default deterministic `hash` backend, an OpenAI-compatible `openai` HTTP backend (uses the `dimensions` parameter to fit the `Vector(384)` schema), or a local `fastembed` backend (optional dependency). Failures fall back to the hash backend.
- Hybrid retrieval — a pure-Python BM25 implementation in `services/context/lexical.py` is blended into the compiler's scoring when `N0TUNE_HYBRID_LEXICAL_WEIGHT > 0`. Vector and lexical scores are min-max normalized before mixing so the weight always means the same thing.
- Optional `fastembed` extras group in `apps/api/pyproject.toml` so users opting into local embeddings install only what they need.
- Rate-limit middleware for `/v1/*` with a pluggable backend (`InMemoryRateLimitBackend` sliding window for single-process dev/tests, `RedisRateLimitBackend` fixed-window INCR+EXPIRE for multi-replica deployments). Configured via `N0TUNE_RATE_LIMIT_RPM`, `N0TUNE_RATE_LIMIT_WINDOW_SECONDS`, and `N0TUNE_RATE_LIMIT_BACKEND`. Disabled by default. Returns `429 Too Many Requests` with a `Retry-After` header. Caller key derives from Bearer token, `X-N0Tune-API-Key`, `X-Forwarded-For`, or the socket peer (in that order).
- Streaming Server-Sent Events for `POST /v1/openai/chat/completions` when `stream: true`. Emits `chat.completion.chunk` deltas split from the resolved answer (works for both live provider answers and semantic-cache hits) and terminates with `data: [DONE]`. The final chunk includes a `n0tune` block with cache hit, provider, and token-saving fields.
- Phase 7 hardening tests in `apps/api/app/tests/test_hardening.py`:
  - Semantic-cache TTL expiration forces a cache miss on the next chat.
  - Soft-deleted memories disappear from list (without `include_deleted`) and from context preview, while recreated memories with identical text get a fresh id without duplicating selections.
  - `/v1/chat` persists a `ContextRun` row whose trace contains both selected memories and excluded high-injection-risk chunks with reasons.
  - Parametrised unit tests for every pattern in `services/security/secrets.py` (OpenAI key, GitHub token, AWS access key, PEM private key, password assignment, bearer token, session cookie).
  - Mocked OpenAI-compatible upstream provider (via `respx`) is invoked with the expected model, system+user messages, and `Authorization: Bearer` header.
- `respx` added as an API dev dependency for HTTP-level provider mocking.
- Test conftest now exposes a `session_factory` fixture so tests can read/write the shared in-memory SQLite engine directly.

## 0.1.0 - 2026-05-16

### Added

- Phase 0 open-source repo foundation.
- Apache-2.0 license.
- Safe `.env.example`.
- Docker Compose stack with Postgres + pgvector, Redis, API, and dashboard services.
- FastAPI app with `GET /health`.
- Next.js dashboard placeholder with local API health display.
- Root documentation, security policy, contribution guide, code of conduct, and Phase 0 docs.
- Basic CI workflow for Python and Node lint/typecheck/tests, Compose config validation, secret scanning, and best-effort dependency audits.
- Pre-commit hook configuration.
- Alembic migrations for the MVP data model.
- Memory CRUD, style profile CRUD, documents, chunks, context preview, chat, cache, and OpenAI-compatible proxy endpoints.
- TypeScript SDK client.
- Dashboard pages for memory, style, documents, context preview, cache, and security.
- MCP stdio server.
- Dogfooding seed script and token-savings report.
- Tests for isolation, prompt injection, secret rejection, semantic cache hits, cache invalidation after memory changes, proxy, and health.

### Not yet implemented

- Latency-true pass-through streaming from an upstream provider (current streaming fans out a fully resolved answer).
- Native Postgres `tsvector` hybrid search (current implementation does BM25 in-process over already-fetched candidates).
- Async embedding HTTP client (current OpenAI embedding call is synchronous).
