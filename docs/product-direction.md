# Product Direction

N0Tune turns any AI model into your personal AI - without fine-tuning.

The product direction is an open-source Personal AI Runtime. The current Gateway/server system remains part of the product, but the public-facing story should move toward a downloadable local desktop app that normal users can understand.

## Main Pitch

N0Tune turns any AI model into your personal AI - without fine-tuning.

Bring GPT, Claude, Gemini, Qwen, OpenRouter, Ollama, LM Studio, or any OpenAI-compatible model. N0Tune adds local memory, style, files, semantic cache, and context compilation.

## Technical Truth

N0Tune does not train the model. It does not fine-tune GPT, Claude, Gemini, Qwen, or a local model.

N0Tune keeps the model unchanged. It learns through local memory, style profiles, file context, semantic cache, and context compilation. That product pattern is context-tuning: fine-tune-like personalization without fine-tuning.

## Primary User Story

The target user cannot afford to fine-tune a large model. They cannot host a large local model. They still want a personal AI that learns their preferences, projects, files, and style.

The intended flow:

1. User downloads N0Tune Desktop.
2. User chooses a provider: OpenAI, Anthropic Claude, Google Gemini, Qwen, OpenRouter, Ollama, LM Studio, or a custom OpenAI-compatible endpoint.
3. User creates a personal AI with a name, avatar, personality, response style, memory mode, and selected files or folders.
4. User chats with it.
5. N0Tune saves useful memories locally.
6. N0Tune retrieves relevant memories, files, and style on future requests.
7. N0Tune compiles a small context.
8. N0Tune sends that context to the selected provider.
9. The model feels personalized without fine-tuning.

## Product Shape

N0Tune has five parts:

| Part           | Role                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| N0Tune Desktop | Downloadable local desktop app for normal users                                |
| N0Tune Core    | Reusable context compiler engine                                               |
| N0Tune CLI     | Setup, diagnostics, import/export, sync, and demos                             |
| N0Tune MCP     | Local MCP server for Claude Desktop, Claude Code, Cursor, and compatible tools |
| N0Tune Gateway | Existing server/API/OpenAI-compatible proxy mode for developers and teams      |

Desktop should be the first product signal. Gateway remains the developer and team infrastructure mode.

## Current Backend Audit

The repo already has meaningful Gateway capabilities that should be preserved:

- FastAPI app and Docker Compose environment
- Postgres + pgvector data model and Alembic migrations
- Redis-ready health and rate limiting paths
- memory CRUD, lifecycle, scope, export, confirm, soft delete, and delete support
- style profile API
- document ingestion, chunking, RAG selection, and prompt-injection scoring
- context preview with selected memories, selected chunks, token estimates, excluded context, and trace
- chat endpoint with development provider and OpenAI-compatible provider routing
- semantic cache with TTL and dependency freshness
- OpenAI-compatible `/v1/openai/chat/completions` endpoint
- API keys, role-based permissions, and audit logs
- dashboard app
- MCP stdio server
- Markdown-folder connector
- Python and TypeScript SDKs
- LangChain, LlamaIndex, and Vercel AI SDK integrations
- evaluation harness and dogfooding scripts
- production, security, scaling, backup, deployment, and observability docs

These are Gateway and future Core assets, not discarded work.

## Positioning Rules

Say:

- personalize any model
- context-tune any model
- local memory for hosted or local models
- fine-tune-like behavior without fine-tuning
- N0Tune changes the context around the model

Do not say:

- train GPT
- fine-tune Gemini instantly
- fine-tune Qwen through N0Tune
- download GPT
- own the model
- N0Tune is a hosted model provider

## What N0Tune Is

N0Tune is:

- an open-source personal AI runtime
- a local-first AI memory layer
- a context compiler
- a desktop companion
- a provider router
- an MCP bridge
- an optional API gateway

N0Tune is not:

- a model
- a fine-tuning service
- a hosted model provider
- a replacement for all RAG frameworks
- a secret manager
- a guarantee against hallucinations
- a system that stores private memory in the cloud by default

## Demo Frame

Use a simple emotional demo:

> Meet Milo: a personal AI powered by Gemini/Qwen/GPT, but tuned by your local memory.

The demo should show the same model answering the same question differently for two people because N0Tune compiled different memory, files, style, and persona context.

## Product Principles

- Desktop first for public positioning.
- Local-first storage for personal memory.
- User brings the model; N0Tune brings memory, files, style, cache, and context.
- Context preview is a core differentiator.
- No private memory sharing by default.
- File indexing is opt-in.
- MCP is local-only by default.
- Gateway remains available for developers and teams.
