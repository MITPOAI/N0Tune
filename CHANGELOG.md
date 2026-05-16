# Changelog

All notable changes to N0Tune will be documented here.

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

- Streaming OpenAI-compatible responses.
- Production rate limiting.
- Production embeddings and hybrid search.
- Kubernetes deployment docs.
