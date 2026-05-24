# Roadmap

## Cross-Tool Context Track

N0Tune's current main story is shared project context:

> Keep context across Claude, Codex, Cursor, and every AI tool.

Phase CT-1 through CT-6 now have a working vertical slice:

- product copy and docs lead with cross-tool project continuity
- project detection API and CLI command
- project-scoped memory
- sessions table and API
- Handoff Capsules table, API, continuation prompt, CLI, and MCP tools
- dashboard surfaces for current project, sessions, and handoffs
- dogfooding doc for Claude-to-Codex continuation

Remaining CT work:

- desktop-local project store and file watcher
- automatic transcript/session capture from tool adapters
- configurable context-pressure thresholds by model/provider
- in-dashboard Handoff Capsule creation form
- screenshots and release QA for the full dashboard flow

N0Tune is pivoting from a backend-first memory gateway into an open-source shared context layer for AI tools.

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

## Phase CG — Context Guard (alignment + grounding)

Goal: add an alignment layer that catches AI-agent drift against the
stored N0Tune plan, rules, and benchmarks. Detail in
[`docs/context-guard.md`](context-guard.md) (user-facing) and
[`docs/alignment-checker.md`](alignment-checker.md) (technical).

This phase is **separate from** Phases A–J above. CG can start in
parallel with any open phase because it adds a new surface
(`/v1/alignment/check`) without changing the existing memory / compiler
/ provider routing.

Sub-phases:

### CG-0 — Design only (v0.1.2, current)

Goal: contributors and AI agents share one mental model of Context
Guard before any code lands.

Tasks:

- write `docs/context-guard.md`, `docs/alignment-checker.md`,
  `docs/dogfooding-alignment.md`
- add a Context Guard section to README
- add this Phase CG block to the roadmap
- add a Context Guard component sketch to `docs/architecture.md`
- add the Context Guard test plan to `docs/testing.md`
- add a CHANGELOG entry under "Unreleased"

Acceptance:

- docs explain what Context Guard does and why
- no code claims are made
- existing tests still pass
- semantic cache + context compiler are not touched

### CG-1 — Rule engine

Goal: deterministic rule checks without LLM calls.

Tasks:

- new module `apps/api/app/services/alignment/rules.py`
- new model `apps/api/app/models/entities.py::AlignmentRule`
- alembic migration for the `alignment_rules` table
- forbidden-phrase, phase-scope, security-pattern, benchmark-claim
  rules with regex
- unit tests for each rule type
- seed a starter rule set under `scripts/seed-alignment-rules.py`

Acceptance:

- `rule_engine.run(rules, content, claims, changed_files)` returns a
  list of `AlignmentIssue` records
- 100% deterministic, no network egress
- tests cover all six rule types

### CG-2 — API endpoint

Goal: `/v1/alignment/check` over the rule engine + retrieval-check.

Tasks:

- `POST /v1/alignment/check`, `POST /v1/alignment/check-diff`,
  `GET/POST /v1/alignment/rules`
- wire to retrieval via the existing context compiler
- API tests
- OpenAPI schema update

Acceptance:

- valid `AlignmentReport` returned for every request
- `/check` and `/check-diff` cover the eight CG-6 fixtures
- admin RBAC enforced on `POST /v1/alignment/rules`

### CG-3 — Dashboard pages

Goal: human-runnable Context Guard + read-only Project Rules viewer.

Tasks:

- "Context Guard" tab in the existing dashboard
- "Project Rules" tab listing the active rules
- Playwright e2e for the Context Guard happy path

Acceptance:

- a user can paste content, hit "Run alignment check", see the report
- rules tab shows the seeded rule set
- e2e green

### CG-4 — CLI

Goal: `n0tune align …` commands.

Tasks:

- `n0tune align check`, `n0tune align diff`, `n0tune align rules`,
  `n0tune align doctor`
- JSON output mode for scripting
- vitest coverage

Acceptance:

- the CG-6 dogfooding pass can be driven entirely from the CLI

### CG-5 — MCP tools

Goal: agents call alignment from inside their own session.

Tasks:

- `n0tune_alignment_check`, `n0tune_get_current_plan`,
  `n0tune_remind_context` in the MCP server
- update `docs/wire-to-claude.md` with the agent workflow

Acceptance:

- Claude / Cursor / Codex can call all three tools
- the smoke test in `integrations/mcp-server/tests/` covers them

### CG-6 — Dogfooding pass

Goal: run Context Guard against N0Tune's own history per
[`docs/dogfooding-alignment.md`](dogfooding-alignment.md).

Tasks:

- run the eight fixture artifacts
- aggregate results into `docs/releases/v0.2.0-cg-dogfooding.md`
- tune rules to eliminate false positives observed
- add missing rules to catch false negatives observed
- ship the final seed rule set with the next release

Acceptance:

- false-positive ceiling: README, product-direction, v0.1.2 release notes
  all return `aligned: true`
- recall floor: v0.1.0 + v0.1.1 release bodies flagged for the framing
  drift documented in v0.1.2
- synthetic positives: terminology, phase-drift, and benchmark fixtures
  all return the matching issue type

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
- LLM judge mode for Context Guard (post-CG-5 if there's demand)
