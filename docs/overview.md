# N0Tune Overview

N0Tune is an open-source Context Compiler and AI Memory Gateway.

It is pronounced "No Tune" and must be written as `N0Tune` with a zero. Package and infrastructure names use `n0tune`.

## Product goal

N0Tune helps any LLM app feel personalized without fine-tuning. It will combine user memory, style profiles, RAG, hybrid search, semantic cache, context ranking, prompt compression, an OpenAI-compatible proxy, an MCP server, and a dashboard.

The central idea is the Context Compiler. It decides what context deserves prompt space for each request.

## MVP status

Implemented:

- repository structure
- Apache-2.0 license
- security and contribution docs
- Docker Compose stack
- FastAPI API with health, memories, style profiles, documents, context preview, chat, cache, and OpenAI-compatible proxy
- Alembic schema with Postgres + pgvector
- Next.js dashboard for the core workflows
- TypeScript SDK client
- MCP stdio server
- dogfooding seed script
- tests, CI, and pre-commit configuration

Not implemented yet:

- streaming proxy responses
- production rate limiting
- hybrid BM25 search
- production embeddings
- Kubernetes deployment docs

## Intended users

- developers building AI assistants
- teams adding memory to chat products
- agent tool authors who need compact context
- self-hosters who want a transparent memory and context layer

## Non-goals

N0Tune is not a model, a fine-tuning service, a replacement for every RAG framework, only a memory database, only a cache, or only a prompt compressor.
