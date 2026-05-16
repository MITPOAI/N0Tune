# Editions

N0Tune has five product editions. They share one idea: use context-tuning to personalize a model without changing model weights.

## Summary

| Edition | Audience                        | Storage                           | Current status                                             |
| ------- | ------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| Desktop | Normal users                    | Local SQLite + local vector store | Planned                                                    |
| Core    | Developers embedding the engine | Adapter-based                     | Python package started                                     |
| CLI     | Power users and maintainers     | Uses Desktop/Core/Gateway config  | Planned                                                    |
| MCP     | Claude/Cursor/agent tools       | Local or Gateway-backed           | Existing server integration, local-first expansion planned |
| Gateway | Developers and teams            | Postgres + pgvector + Redis       | Existing                                                   |

## N0Tune Desktop

Desktop is the public-facing product.

It should provide:

- downloadable app
- onboarding
- provider selection
- local memory
- style profile
- persona/avatar
- local file indexing
- memory viewer/delete/export
- context preview
- optional floating widget later

Desktop users should not need Postgres, Redis, Docker, or a hosted N0Tune server.

## N0Tune Core

Core is the reusable context compiler engine. It lives in `packages/core`.

It currently owns shared Python primitives for:

- token estimation
- stable hashing
- deterministic hash embeddings
- cosine similarity
- lexical BM25 scoring
- prompt-injection scanning
- secret detection
- context formatting
- score blending
- interface contracts

It is still being expanded toward full interfaces for:

- memory stores
- style stores
- document stores
- provider routing
- context compilation
- token estimation
- prompt-injection and secret scanning
- semantic cache

Gateway and Desktop should converge on Core where practical.

## N0Tune CLI

The CLI is not the main product. It supports setup, diagnostics, local demos, import/export, and developer workflows.

Planned commands:

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

The CLI should not silently modify user MCP config files without confirmation.

## N0Tune MCP

MCP is the bridge for Claude Desktop, Claude Code, Cursor, and compatible tools.

The current repo has a stdio MCP server in `integrations/mcp-server`. Its role is to expose N0Tune memory, style, documents, and context preview to MCP clients.

Future local-first tools should include:

- `n0tune_search_memories`
- `n0tune_save_memory`
- `n0tune_get_style_profile`
- `n0tune_search_files`
- `n0tune_context_preview`
- `n0tune_forget_memory`
- `n0tune_get_persona`

Security defaults:

- local-only by default
- scoped to one user/persona unless configured
- no shell execution
- no API key exposure
- safe logs
- user can disable MCP

## N0Tune Gateway

Gateway is the existing server/API mode.

It is for:

- developers
- teams
- hosted deployments
- API proxy use cases
- RBAC and audit logs
- production deployment
- evaluations and integrations

Current Gateway features include:

- FastAPI backend
- Postgres + pgvector
- Redis-ready infrastructure
- OpenAI-compatible proxy
- API keys
- role-based permissions
- audit logs
- markdown connector
- semantic cache
- context preview
- dashboard
- production docs

Gateway remains important. The product reframe does not remove or devalue the existing server work.
