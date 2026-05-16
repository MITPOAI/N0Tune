# Roadmap

## Implemented MVP

- Phase 0: repo foundation, docs, security policy, Docker Compose, CI, health API, dashboard shell.
- Phase 1: FastAPI MVP, Alembic migrations, Postgres + pgvector schema, memory CRUD, style CRUD, documents, chunks, context preview.
- Phase 2: chat endpoint, Context Compiler, provider abstraction, safe memory extraction, semantic cache.
- Phase 3: OpenAI-compatible chat completions endpoint and app API-key validation.
- Phase 4: dashboard pages for memories, style, documents, context preview, cache, and security.
- Phase 5: MCP stdio server with memory, docs, style, context preview, and forget tools.
- Phase 6: dogfooding seed script and token-savings report path.
- Phase 7: tests for isolation, prompt injection, secret rejection, semantic cache hits, cache invalidation after memory changes, OpenAI proxy, and health.

## Next Hardening Work

- production rate limiting
- request body size middleware
- stronger auth bootstrapping and key rotation
- hybrid search
- production embeddings
- streaming OpenAI-compatible proxy
- dashboard e2e tests and screenshots
- cache invalidation on document mutation, style changes, and app config changes
- Kubernetes docs
