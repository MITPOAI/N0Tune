# Roadmap

## Shipped

- **Phase 0** — Repo foundation, docs, security policy, Docker Compose, CI, health API, dashboard shell.
- **v0.1** — FastAPI MVP, Alembic migrations, Postgres + pgvector schema, memory CRUD, style CRUD, documents, chunks, context preview.
- **v0.2** — Chat endpoint, Context Compiler, provider abstraction, safe memory extraction, semantic cache.
- **v0.3** — OpenAI-compatible chat completions endpoint with SSE streaming and app API-key validation.
- **v0.4** — MCP stdio server with memory, docs, style, context preview, and forget tools.
- **v0.5** — Dashboard pages for memories, style, documents, context preview, cache, and security; dogfooding seed script.
- **v0.6** — Security hardening tests (isolation, prompt injection, secret rejection, semantic cache, cache invalidation, OpenAI proxy, health). Redis-backed rate limiting. Pluggable embedding provider (`hash` / `openai` / `fastembed`) with in-process BM25 hybrid retrieval.
- **v1.0 scope landed** — k8s manifests doc; Playwright dashboard e2e suite; Python SDK; LangChain / LlamaIndex / Vercel AI SDK integration packages; Langfuse observability; Markdown-folder connector; token-savings eval harness with reproducible 17.4% headline; local-mode Ollama example.
- **Post-v1 Phase 8** — Eval harness shipped (`evals/token_savings_eval` real; other evals stubbed with documented methodology).
- **Post-v1 Phase 9** — Memory lifecycle: `state`, decay, `confirm`/`export`, schema fields for future contradiction handling.
- **Post-v1 Phase 10** — Memory scopes (user / shared) with compiler-side filtering.
- **Post-v1 Phase 11** — Role-based permissions, multi-key API key management, audit log.
- **Post-v1 Phase 12** — Markdown folder connector.
- **Post-v1 Phase 13** — Local-mode documentation + runnable Ollama example.
- **Post-v1 Phase 14** — Production deployment docs (production / scaling / backup-restore / deployment-security / observability).

## Next

Not yet implemented; pick the one that unlocks the most user value first:

- **Real evals.** `memory_relevance_eval`, `context_compression_eval`,
  `prompt_injection_eval`, `semantic_cache_eval`, `answer_quality_eval`.
  Stubs already exist; each needs a labelled dataset and a `run.py`.
- **Memory intelligence v2.** Duplicate detection on memory create, automatic
  contradiction handling that flips superseded rows to `deprecated`, and
  approval workflow (`auto` / `review` / `manual`).
- **More connectors.** GitHub repository docs, Notion, Google Drive, Slack
  archive — pick the first one based on actual user requests. Pattern is
  established in `docs/connectors.md`.
- **Latency-true streaming.** Pass-through SSE from the upstream provider
  rather than fanning out a resolved answer.
- **Native pgvector / tsvector retrieval.** Replace the in-process scoring
  loop with SQL-side filtering once corpora outgrow it.
- **Async embedding HTTP client.** The OpenAI embedding path is currently
  synchronous and blocks the event loop briefly.
- **Cache invalidation on style + document edits.** Already invalidates on
  memory edits; the other two paths need wiring.
- **`n0tune doctor` and `n0tune demo` CLIs.** Documented in the README's
  viral demo section but not implemented yet.

## Deferred until users ask

- Kubernetes Helm chart (raw manifests in `docs/k8s.md` work today).
- Terraform modules.
- Plugin marketplace.
- Billing.
- Enterprise audit exports / SOC2 evidence collection.
- Complex multi-agent orchestration.
- Graph-based memory.
- Bring-your-own-vector-store (pgvector covers the immediate need).
