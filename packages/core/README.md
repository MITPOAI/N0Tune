# N0Tune Core

N0Tune Core is the reusable context-tuning package for N0Tune.

Status: Phase B implementation started. Core now contains shared Python primitives used by N0Tune Gateway. It is not yet the full cross-runtime Desktop/Gateway engine.

## What Lives Here Now

Implemented:

- token estimation
- text normalization and stable hashing
- deterministic hash embeddings for local/dev paths
- cosine similarity
- BM25 lexical scoring and score normalization
- prompt-injection risk scanning
- secret-pattern detection
- compiled-context formatting
- naive-token baseline estimation
- score blending for hybrid retrieval
- Protocol interfaces for future stores, routers, scanners, cache, and compiler adapters

Still outside Core:

- SQLAlchemy persistence
- FastAPI routes
- provider HTTP calls
- OpenAI/fastembed embedding adapters
- memory lifecycle database writes
- semantic cache database dependency checks
- Desktop SQLite/vector adapters

## Why Python First

Gateway is currently Python. Phase B extracts logic into Python first so the existing FastAPI Gateway can actually reuse it immediately.

Desktop may later use a TypeScript/Rust-facing Core wrapper or a separate port once the stable contracts are proven. The important boundary is storage-neutral logic first, not duplicating server behavior behind a fake package.

## Package Layout

```text
packages/core/
|-- pyproject.toml
|-- src/n0tune_core/
|   |-- compiler.py
|   |-- interfaces.py
|   |-- lexical.py
|   |-- security.py
|   |-- tokens.py
|   `-- py.typed
`-- tests/
```

## Interfaces

Core defines Protocol contracts for:

- `MemoryStore`
- `StyleStore`
- `DocumentStore`
- `ProviderRouter`
- `ContextCompiler`
- `SecurityScanner`
- `CacheStore`

The names are Pythonic snake_case in code, but they map to the product contracts from the roadmap:

- `addMemory` -> `add_memory`
- `searchMemories` -> `search_memories`
- `compileContext` -> `compile_context`
- `explainTrace` -> `explain_trace`
- `estimateTokens` -> `estimate_tokens`

## Gateway Usage

Gateway now imports Core for:

- default style profile
- untrusted-context boundary text
- token estimation
- stable hash
- deterministic hash embedding helper
- cosine similarity
- lexical BM25 scoring
- score blending
- compiled-context rendering
- secret detection
- prompt-injection scanning

Gateway keeps database and HTTP concerns in `apps/api`.

## Development

Install:

```powershell
.\.venv\Scripts\python -m pip install -e ".\packages\core[dev]"
```

Run tests:

```powershell
.\.venv\Scripts\python -m pytest .\packages\core
```

Run checks:

```powershell
.\.venv\Scripts\ruff check packages/core
.\.venv\Scripts\mypy packages/core/src
```

## Next Extraction Steps

1. Move more context selection into Core while keeping persistence in adapters.
2. Add local-store interfaces for Desktop SQLite/vector adapters.
3. Add provider config validation contracts.
4. Add cache dependency freshness as an adapter-backed Core service.
5. Add cross-edition conformance tests so Desktop and Gateway compile equivalent context for the same inputs.
