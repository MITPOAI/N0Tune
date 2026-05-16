# Roadmap

N0Tune is pivoting from a backend-first memory gateway into an open-source Personal AI Runtime.

The existing server/API work is preserved as **N0Tune Gateway**. The public product direction becomes Desktop first, with Core, CLI, MCP, and Gateway supporting that experience.

## Current Shipped Foundation

The repo already includes the Gateway/server foundation:

- FastAPI API
- Python Core package with shared context-tuning primitives
- Postgres + pgvector migrations
- Redis-ready health and rate limiting
- memory CRUD, lifecycle, scopes, export, confirm, soft delete, and delete paths
- style profile CRUD
- document chunking and RAG context selection
- context preview with trace and token estimates
- chat endpoint with development and OpenAI-compatible provider paths
- semantic cache
- OpenAI-compatible chat completions endpoint
- API keys, RBAC, and audit logs
- dashboard app
- MCP stdio server
- Markdown-folder connector
- Python and TypeScript SDKs
- LangChain, LlamaIndex, and Vercel AI SDK integrations
- eval harness and dogfooding scripts
- production, security, scaling, backup, deployment, and observability docs

## Phase A - Product Reframe

Goal: reframe the repo around N0Tune as a personal AI runtime and context compiler without breaking Gateway.

Tasks:

- update README
- add product direction docs
- add Desktop architecture docs
- document Desktop, Core, CLI, MCP, and Gateway editions
- explain context-tuning honestly
- update dogfooding docs to connect Gateway to future Desktop
- add placeholder architecture docs for Core, Desktop, CLI, personas, and desktop demo
- update changelog

Acceptance:

- README leads with personal AI runtime positioning
- Gateway is preserved and clearly named
- no fake Desktop, CLI, or Core implementation is claimed
- existing tests still pass or failures are documented

## Phase B - Core Extraction

Goal: make N0Tune Core reusable by both Desktop and Gateway.

Package: `packages/core`.

Implemented in the first Phase B slice:

- installable `n0tune-core` Python package
- token estimation
- stable hashing
- deterministic hash embedding helper
- cosine similarity
- BM25 lexical scoring
- prompt-injection scanner
- secret detector
- context renderer
- naive-token baseline estimator
- hybrid score blending
- Protocol interface contracts
- Gateway imports Core for the shared primitives above

Remaining Core interfaces:

- `MemoryStore`
- `StyleStore`
- `DocumentStore`
- `ProviderRouter`
- `ContextCompiler`
- `SecurityScanner`
- `CacheStore`

Rules:

- do not duplicate logic
- Gateway should use Core where practical
- Desktop should later use Core
- add tests for core logic
- keep storage behind adapters
- keep API/Gateway tests green while extracting more logic

## Phase C - Desktop Alpha

Goal: create the first local app.

Default stack:

- Tauri
- React
- TypeScript
- SQLite
- sqlite-vec, LanceDB, or equivalent local vector store

Required features:

- onboarding
- provider settings
- chat UI
- local memory
- style profile
- memory viewer
- context preview
- no cloud storage by default
- no Postgres or Redis requirement

## Phase D - Provider Router

Goal: support the major hosted and local provider paths for Desktop and Gateway.

Provider targets:

- OpenAI
- Anthropic Claude
- Google Gemini
- Qwen via official API or OpenRouter-compatible route
- OpenRouter
- Ollama
- LM Studio
- custom OpenAI-compatible endpoints

Security requirements:

- never log API keys
- store Desktop keys in OS keychain if practical
- support deleting keys
- surface provider errors without exposing secrets

## Phase E - CLI

Goal: provide diagnostics, setup, import/export, and demos.

Commands:

- `n0tune doctor`
- `n0tune init`
- `n0tune demo`
- `n0tune memory list`
- `n0tune memory add`
- `n0tune memory delete`
- `n0tune memory export`
- `n0tune persona export`
- `n0tune persona import`
- `n0tune files sync`
- `n0tune mcp install`
- `n0tune gateway start`
- `n0tune desktop start`

The CLI should not become the main product. It supports Desktop, Core, MCP, and Gateway.

## Phase F - MCP

Goal: make N0Tune memory and context available to Claude Desktop, Claude Code, Cursor, and compatible tools.

Tools:

- `n0tune_search_memories`
- `n0tune_save_memory`
- `n0tune_get_style_profile`
- `n0tune_search_files`
- `n0tune_context_preview`
- `n0tune_forget_memory`
- `n0tune_get_persona`

Defaults:

- local-only
- scoped to one user/persona unless configured
- no shell execution
- no API key exposure
- safe logs
- user can disable MCP

## Phase G - Local File Memory

Goal: let users opt into local file indexing.

MVP:

- selected folder indexing
- `.md` and `.txt` first
- context preview with file chunks
- prompt-injection scan
- file count in diagnostics

Later:

- PDF
- richer file permissions
- include/exclude rules
- encrypted backups

## Phase H - Personas and Sharing

Goal: make personal AIs portable without leaking private memory by default.

Planned:

- `.n0tune` persona export/import
- persona presets
- avatar reference
- style profile
- allowed tools
- no private memory by default
- optional selected memories
- encrypted backup later

## Phase I - Floating Widget

Goal: quick access to a personal AI without overbuilding avatar tech.

MVP:

- tray app
- mini chat
- global hotkey if practical
- 2D avatar or logo

Deferred:

- Live2D
- VRM 3D
- complex desktop animation

## Phase J - Public Alpha Release

Goal: ship a coherent alpha.

Checklist:

- installers or clear dev install
- demo video or GIF
- README polish
- privacy docs
- security docs
- examples
- release checklist
- known limitations

## Deferred Until Users Ask

- Helm chart
- Terraform modules
- plugin marketplace
- billing
- enterprise audit exports
- SOC2 evidence collection
- complex multi-agent orchestration
- graph-based memory
- bring-your-own-vector-store for Desktop
