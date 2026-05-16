# N0Tune Overview

**Fine-tune any AI. Without fine-tuning.**

N0Tune is a context-tuning system. Bring any model — GPT, Claude,
Gemini, Qwen, OpenRouter, Ollama, LM Studio, anything OpenAI-compatible
— and N0Tune adds the personalization layer on top: local memory, a
persona profile, indexed files, a semantic cache, and a context
compiler that fits all of it into a token budget per request.

It is pronounced "No Tune" and must be written as `N0Tune` with a zero.
Package and infrastructure names use `n0tune`.

## Product Goal

Fine-tuning changes model weights. That's expensive, slow, locks you
into a provider, and needs training data + GPU access. N0Tune doesn't
touch the model. It changes the **prompt** — picking the relevant
memories + chunks + persona for the current question, fitting them into
a small context window, and routing the result to whatever model you
chose.

The system is consumable from two surfaces, both first-class:

- **Standalone:** the N0Tune Desktop app — your personal AI on your
  machine. Tray + hotkey + chat + memory + files.
- **As a layer under other AI tools:** the MCP server, OpenAI-compatible
  proxy, and SDKs let Claude Code, Cursor, Codex CLI, ChatGPT-shaped
  clients, and your own code use the same memory + compiler.

See [`product-direction.md`](product-direction.md) for the full pitch.

## Product Parts

- N0Tune Desktop: planned downloadable local app for normal users
- N0Tune Core: reusable context compiler primitives, currently implemented as a Python package
- N0Tune CLI: planned setup, diagnostics, import/export, sync, and demo tool
- N0Tune MCP: local MCP bridge for Claude Desktop, Claude Code, Cursor, and compatible tools
- N0Tune Gateway: existing server/API/OpenAI-compatible proxy mode

See [editions.md](editions.md).

## Current Implementation

Implemented today as Gateway/server mode:

- Docker Compose stack
- Python Core package in `packages/core`
- FastAPI API
- health, memories, style profiles, documents, context preview, chat, cache, API keys, and audit logs
- Alembic schema with Postgres + pgvector
- Redis-ready rate limiting and health checks
- OpenAI-compatible proxy
- Next.js dashboard
- TypeScript and Python SDKs
- MCP stdio server
- Markdown-folder connector
- LangChain, LlamaIndex, and Vercel AI SDK integrations
- eval harness and dogfooding seed script
- tests, CI, and pre-commit configuration
- production, scaling, security, backup, and observability docs

Not implemented yet:

- Desktop app
- CLI package
- local Desktop SQLite/vector adapters
- `.n0tune` persona runtime
- floating widget

Partially implemented:

- Core package extraction. Token, security, lexical retrieval, context formatting, score blending, and interface contracts now live in `packages/core`. Full storage/provider/cache adapter extraction is still future work.

## Intended Users

- normal users who want a personal AI without training a model
- developers building AI assistants
- teams adding memory/context to chat products
- agent tool authors who need compact context
- self-hosters who want transparent memory and context control

## Non-Goals

N0Tune is not a model, a fine-tuning service, a hosted model provider, a replacement for every RAG framework, only a memory database, only a cache, or only a prompt compressor.
