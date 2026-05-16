# N0Tune Overview

N0Tune turns any AI model into your personal AI - without fine-tuning.

It is pronounced "No Tune" and must be written as `N0Tune` with a zero. Package and infrastructure names use `n0tune`.

## Product Goal

N0Tune is an open-source Personal AI Runtime.

The user brings GPT, Claude, Gemini, Qwen, OpenRouter, Ollama, LM Studio, or any OpenAI-compatible endpoint. N0Tune adds local memory, style, files, semantic cache, and context compilation.

Fine-tuning changes model weights. N0Tune keeps the model unchanged and uses context-tuning: fine-tune-like personalization without fine-tuning.

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
