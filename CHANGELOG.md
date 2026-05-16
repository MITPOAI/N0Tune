# Changelog

All notable changes to N0Tune will be documented here.

## 0.1.2 - 2026-05-17

A framing + dynamics release. Same product surface as 0.1.1; what
changes is the **headline** (back to context-tuning), the
**continual-learning loop** (now dynamic), and the **download path**
(cross-platform release workflow). Full notes in
[docs/releases/v0.1.2.md](docs/releases/v0.1.2.md).

### Framing

- **Headline reframe.** v0.1.1's "armor for your AI tools" understated
  what the system actually delivers. Restored "Fine-tune any AI.
  Without fine-tuning." as the headline across README,
  product-direction, overview, editions, how-it-works, install,
  CLAUDE.md, AGENTS.md, Tauri bundle metadata, and the dogfooding seed
  memories. Both the standalone Desktop and the integration layer (MCP
  / OpenAI proxy / SDKs) are framed as first-class surfaces.

### Dynamic consolidation

- **Auto-trigger** on `POST /v1/chat`, `POST /v1/openai/chat/completions`,
  and `POST /v1/memories` via FastAPI `BackgroundTasks`. The trigger
  short-circuits cheaply when the user has fewer than 12 active memories
  or the last summary is younger than the 15-minute cooldown; otherwise
  it runs the full clustering pass.
- Trigger conditions live in
  `app.services.memory.consolidation.should_auto_consolidate`. The
  background runner is `maybe_consolidate(session_factory, app_id, user_id)`.
- Consolidation **does not call any provider** by default — the summary
  is a deterministic concatenation of the cluster members. The
  provider-backed summary remains opt-in via `summarize=True` on the
  explicit endpoint, using the same provider you configured for chat.
- End-to-end smoke against the live stack: 13 similar memories →
  background pass fires after the 13th write → 1 summary + 2 deprecated,
  zero LLM tokens spent.

### Release workflow

- New `.github/workflows/release.yml` builds the Tauri bundle on
  windows-latest, macos-14 (arm64), macos-13 (x64), and ubuntu-22.04 on
  every `v*` tag push, then uploads every `.exe / .msi / .dmg /
  .AppImage / .deb` to the matching GitHub Release. v0.1.2 is the first
  release where pre-built installers are downloadable.

## 0.1.1 - 2026-05-17

Polish release. Same product surface as 0.1.0, but CI is green, agents
get a one-page operating manual, and the install story is documented.
Full notes in [docs/releases/v0.1.1.md](docs/releases/v0.1.1.md).

### CI

- Gitleaks no longer trips on the literal `X-N0Tune-API-Key` header name
  in CHANGELOG prose. `.gitleaks.toml` gets `regexTarget = "line"`,
  a `CHANGELOG.md` path entry, the header regex, and the project
  stopwords; `.gitleaksignore` pins the historical fingerprint.
- `integrations/vercel-ai-sdk` and `apps/desktop` typecheck clean.
  `packages/sdk-js` got a `prepare` script (npm install builds `dist/`)
  and the Node CI job builds `@n0tune/sdk` before any workspace
  typechecks run.
- Playwright e2e — removed a stale `aria-label="Refresh data"` that
  shadowed the "Refresh" button text and broke the anchored test
  regex. CI now also polls `localhost:3000` before starting tests
  (the dashboard container has no healthcheck).

### Agents

- `CLAUDE.md` + `AGENTS.md` at the repo root. Armor framing, hard
  rules, repo map, conventions, pre-PR commands. Future agents stay
  grounded.

### Install

- `docs/install.md` — standalone install guide with a paste-able
  prompt that has the AI itself wire up MCP for you.

### UI

- Desktop styles: light/dark via prefers-color-scheme, refined palette,
  focus rings, subtle motion, tabular numerals on the status overlay.
- Dashboard styles + Tailwind config: matched transitions, surface
  shadows, hover/active states, and the header tag reframed from
  "Personal AI Runtime" to "Armor for your AI tools".

### Tauri

- Removed every iOS/Android `cfg` gate from `apps/desktop/src-tauri`.
  The project targets Windows/macOS/Linux only.

### Dogfooding

- `scripts/seed-dogfooding.ps1` now indexes the armor docs alongside
  `context-compiler.md` and posts armor-framed seed memories. Three
  context previews fire end-to-end to confirm the compiler returns
  the right framing.

## 0.1.0 - 2026-05-17

First tagged release. The "armor for your AI tools" framing replaces the
earlier "Personal AI Runtime" pitch — the Desktop chat is now a fallback
and the headline integrations are MCP (Claude / Cursor / Codex CLI) +
the OpenAI-compatible Gateway proxy + the tray-hotkey path for any other
tool. Full release notes in [docs/releases/v0.1.0.md](docs/releases/v0.1.0.md).

### Highlights

- Reframe: README + product-direction + how-it-works + editions
  restructured around "armor not warrior." `docs/wire-to-codex-cli.md`
  and `docs/wire-to-gemini-cli.md` ship as first-class integration
  docs.
- New `n0tune compile <message>` CLI subcommand for tools (Gemini CLI,
  vim, anything) that accept a system prompt as text/file.
- `scripts/gen-icons.py` regenerates icons + favicons from
  `img/logo-s2.png`.
- Desktop tray icon + global hotkey (`Cmd+Shift+Space` mac,
  `Alt+Space` elsewhere). Quick-remember overlay + status overlay.
  Window close hides to tray instead of quitting.
- Rust-side SQLite (`apps/desktop/src-tauri/src/storage.rs`) + OS
  keychain (`secrets.rs`). Desktop installer is now self-contained;
  the renderer `TauriBackend` routes memory + provider keys through
  the Rust runtime.
- Continual-learning loop: `POST /v1/memories/consolidate` clusters
  similar memories and collapses them into a denser summary. New
  `n0tune memory consolidate [--dry-run]` CLI subcommand.

### Smoke at tag time

- 93 Python tests, 6 Node workspaces typecheck + test green.
- `mypy --strict`, `ruff`, `eslint --max-warnings=0` clean.
- `python -m evals token_savings` reproduces 17.4 %.

## Unreleased

### Added

- Phase B Core extraction:
  - Added installable Python package `packages/core` as `n0tune-core`.
  - Core now owns shared token estimation, stable hashing, deterministic hash embeddings, cosine similarity, BM25 lexical scoring, prompt-injection scanning, secret detection, context rendering, naive-token baseline estimation, hybrid score blending, and Protocol interface contracts.
  - Gateway now imports Core for shared context-tuning primitives while keeping FastAPI, SQLAlchemy persistence, provider HTTP calls, and cache dependency checks in `apps/api`.
  - Added Core unit tests and wired Core into CI, Docker build context, testing docs, and the local `check-mvp.ps1` validation script.
- Dashboard Context Lab:
  - Added a no-fake-output product demo that creates or selects two users, seeds different style memories, calls `/v1/context/preview` for both, and compares selected memories, selected document chunks, compiled context, token estimates, token savings, warnings, and context trace side by side.
  - Added memory deletion, context trace rendering, selected memory/document panels, warning surfacing, and an audit-log tab for owner/admin inspection.
- Phase A product reframe:
  - README now positions N0Tune as an open-source Personal AI Runtime: "N0Tune turns any AI model into your personal AI - without fine-tuning."
  - Added `docs/product-direction.md`, `docs/desktop-architecture.md`, `docs/editions.md`, and `docs/context-tuning.md`.
  - Reframed the existing FastAPI server/API work as N0Tune Gateway while preserving the current implementation path.
  - Updated `docs/overview.md` and `docs/architecture.md` so older docs match the Desktop/Core/CLI/MCP/Gateway product shape.
  - Updated `docs/roadmap.md` with the Desktop/Core/CLI/MCP/Gateway roadmap.
  - Updated `docs/dogfooding.md` to explain how the current Gateway dogfooding loop supports future Desktop/Core work.
  - Added architecture placeholders for `apps/desktop`, `packages/core`, `packages/cli`, `personas`, and `examples/desktop-personal-ai`.

- Phase 11 — Permissions + audit log:
  - Four roles (`viewer`, `developer`, `admin`, `owner`) with a permission matrix in `services/security/permissions.py`.
  - New `api_keys` table and `POST/GET/DELETE /v1/api-keys` for minting, listing, and revoking app keys. Plaintext is returned once; only the hash is stored.
  - New `audit_logs` table and `GET /v1/audit-logs` (admin-only). Memory and document mutations + API key changes now write audit rows.
  - Legacy `N0TUNE_APP_API_KEY` remains valid as an `owner` role for backward compatibility.
  - 11 new tests in `apps/api/app/tests/test_permissions_and_audit.py`.
  - `docs/permissions.md` and `docs/audit-logs.md`.
- Phase 9 — Memory lifecycle:
  - New columns on `memories`: `state`, `last_used_at`, `last_confirmed_at`, `version`, `replaced_by_memory_id`.
  - `services/memory/lifecycle.py`: state set, retrievable filter, exponential decay anchored at `last_confirmed_at` / `last_used_at` / `updated_at`, `confirm`/`deprecate` helpers.
  - `POST /v1/memories/{id}/confirm` pins confidence past the half-life.
  - `GET /v1/memories/export` returns soft-deleted rows for privacy compliance.
  - Compiler now stamps `last_used_at` on selected memories without invalidating the semantic cache (regression fixed by removing `onupdate=now_utc` from `memories.updated_at`).
  - `docs/memory-lifecycle.md`.
- Phase 10 — Memory scopes:
  - New `scope` column on `memories` (`global`, `app`, `org`, `team`, `project`, `user`, `session`).
  - Compiler retrieves user-scoped memories plus shared-scope memories from the same app; cross-user `user`-scoped memories stay private.
  - `docs/memory-scopes.md`.
  - 9 new tests covering the lifecycle and scope behaviors.
- Phase 8 — Evaluation harness:
  - `evals/` directory with a shared `harness.py` and a `python -m evals` runner.
  - `evals/token_savings_eval/` is the first real eval (scenarios JSON + a runnable script). The honest "stuff everything in" baseline is computed locally rather than trusted from the API. Current headline: **17.4 % token savings** with the deterministic hash backend.
  - Placeholders for `memory_relevance_eval`, `context_compression_eval`, `prompt_injection_eval`, `semantic_cache_eval`, `answer_quality_eval` clearly labelled as future work.
  - `docs/evaluations.md` and `docs/benchmarks.md`.
- Phase 12 — Markdown folder connector:
  - `integrations/markdown-folder/` shipped as `n0tune-markdown-folder` with a `n0tune-markdown-sync` CLI.
  - Walks `*.md` / `*.markdown` files, hashes content, calls `POST /v1/documents`, skips unchanged files on re-sync.
  - 5 new tests using mocked SDK transport.
  - `docs/connectors.md` documents the connector contract for future ones.
- Phase 13 — Local / offline mode:
  - `docs/local-mode.md` covering Ollama, LM Studio, vLLM, and `fastembed` paths.
  - `examples/local-ollama/README.md` rewritten as a runnable example with `host.docker.internal` notes for Linux, prerequisites, smoke commands, and troubleshooting.
- Phase 14 — Production deployment docs:
  - `docs/production.md` — env-var matrix, pre-deploy checklist, TLS + streaming proxy notes, logging redaction, upgrade strategy.
  - `docs/scaling.md` — layer-by-layer scaling guidance and pgvector HNSW index commands.
  - `docs/backup-restore.md` — backup tiers, end-user data deletion, disaster scenarios.
  - `docs/deployment-security.md` — network policy, secrets, container hardening, incident response.
  - `docs/observability.md` expanded with a production monitoring table and a Grafana-friendly query against `context_runs`.
- `docs/dogfooding.md` rewritten as a reproducible loop with the latest 17.4 % token-savings headline and an honest "what broke and what we changed" section.
- `img/logo.png` is committed and referenced from the top of the README.
- Issue templates for bugs, features, security reports, and docs issues plus a `config.yml` that disables blank issues and points users at Discussions and the private security policy. ([`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/))
- Pull request template with a structured "what / why / tests / docs / security / breaking / checklist" body. ([`.github/pull_request_template.md`](.github/pull_request_template.md))
- `docs/maintainers.md` — triage cadence, review checklist, release flow, hotfix flow, dependency hygiene.
- `docs/docs-style-guide.md` — voice, headings, code blocks, naming, examples-talk-to-the-API conventions.
- `docs/testing.md` — canonical list of test commands, layered surface table, smoke flow, secret scanning, and known gaps.
- `examples/personalized-rag-demo/README.md` and `evals/README.md` placeholders, each clearly labelled as v1.0 deliverables with the curl-only reproduction users can run today.
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

### Changed

- Secret scanning now runs the **Gitleaks CLI** in a dedicated [`.github/workflows/security.yml`](.github/workflows/security.yml). The previous `gitleaks/gitleaks-action@v2` job is removed from CI because the action requires a paid `GITLEAKS_LICENSE` secret on organization-owned repos and breaks CI for forks. `docs/security.md` documents both paths.
- `CONTRIBUTING.md` points contributors at the new issue/PR templates and the new docs (`docs/maintainers.md`, `docs/docs-style-guide.md`, `docs/testing.md`).

### Not yet implemented

- Latency-true pass-through streaming from an upstream provider (current streaming fans out a fully resolved answer).
- Native Postgres `tsvector` hybrid search (current implementation does BM25 in-process over already-fetched candidates).
- Async embedding HTTP client (current OpenAI embedding call is synchronous).
