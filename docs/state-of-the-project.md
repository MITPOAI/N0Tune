# State of the project — N0Tune by MITPOAI

A snapshot for contributors and curious readers as of **v0.1.4
(2026-05-17)**. Updated by hand at every release.

> If this doc disagrees with the README or release notes, the release
> notes win — they're the source of truth for any given tag. This
> doc's job is to give you the *current* shape, honestly.

## What N0Tune is

**A context-tuning system. Fine-tune any AI, without fine-tuning.**

You bring any model — OpenAI, Anthropic, Gemini, Qwen, OpenRouter,
Ollama, LM Studio, anything OpenAI-compatible. N0Tune adds the
personalization layer on top: local memory, a persona profile,
indexed files, semantic cache, and a context compiler that builds a
compact personal prompt per request. Same model, personal answer.

N0Tune is **not**:

- a model or a fine-tuning service
- a hosted-model provider
- a secret manager
- a guarantee against hallucinations
- a system that stores private memory in the cloud by default

The system runs locally by default. Memory lives in your machine's
SQLite + OS keychain (Desktop) or in a Postgres you run yourself
(Gateway). **Zero telemetry, by product promise.**

## How you consume it (two equal surfaces)

| Surface | What it is | When to use it |
| --- | --- | --- |
| **Desktop app** ([apps/desktop](../apps/desktop)) | Tauri 2 + React 19. Tray + global hotkey + chat fallback. Local SQLite + OS keychain. | You want a standalone personal AI on your machine. |
| **Integration layer** ([integrations/mcp-server](../integrations/mcp-server)) | Stdio MCP server, 8 tools. Plus OpenAI-compatible HTTP proxy. Plus SDKs. | You want N0Tune *under* Claude Code, Cursor, Codex CLI, ChatGPT-shaped clients, or your own code. |

Both surfaces share the same memory + persona + cache + compiler.
A memory you save in Desktop is the same memory Claude Code retrieves
via MCP.

## Tech stack, by layer

### Gateway (Python)

| Component | Choice | Where |
| --- | --- | --- |
| Web framework | FastAPI 0.115+ | [apps/api/app/main.py](../apps/api/app/main.py) |
| ORM | SQLAlchemy 2 | [apps/api/app/models/entities.py](../apps/api/app/models/entities.py) |
| Migrations | Alembic | [apps/api/alembic/versions/](../apps/api/alembic/versions/) |
| Database | Postgres 16 + pgvector | [docker-compose.yml](../docker-compose.yml) |
| Cache / rate limit | Redis 7 | docker-compose |
| Embeddings | hash (default, no key needed) / OpenAI / `fastembed` | [services/context/embedding.py](../apps/api/app/services/context/embedding.py) |
| Provider router | Custom — OpenAI / Anthropic / Gemini wire shapes | [services/providers/router.py](../apps/api/app/services/providers/router.py) |
| Test | pytest + httpx | [apps/api/app/tests/](../apps/api/app/tests/) |
| Lint / typecheck | ruff + mypy strict | [mypy.ini](../mypy.ini) |

### Desktop (Tauri 2)

| Component | Choice | Where |
| --- | --- | --- |
| Runtime | Tauri 2 (Rust + WebView) | [apps/desktop/src-tauri/](../apps/desktop/src-tauri/) |
| Renderer | React 19 + Vite 6 | [apps/desktop/src/](../apps/desktop/src/) |
| Local storage | rusqlite (bundled) | [src-tauri/src/storage.rs](../apps/desktop/src-tauri/src/storage.rs) |
| Secret storage | `keyring` crate (OS-native: macOS Keychain, Windows Credential Manager, Linux Secret Service) | [src-tauri/src/secrets.rs](../apps/desktop/src-tauri/src/secrets.rs) |
| Tray + global hotkey | tauri-plugin-tray + tauri-plugin-global-shortcut | [src-tauri/src/lib.rs](../apps/desktop/src-tauri/src/lib.rs) |
| Platforms | Windows · macOS · Linux | (no iOS / Android) |

### MCP server

Stdio Node 20 script. Eight tools:

- `n0tune_search_memories`
- `n0tune_save_memory`
- `n0tune_forget_memory`
- `n0tune_get_style_profile`
- `n0tune_search_docs`
- `n0tune_context_preview`
- `n0tune_get_persona`
- `n0tune_alignment_check` *(new in v0.1.3)*

See [docs/wire-to-claude.md](wire-to-claude.md) for the wiring guide.

### SDKs + integrations

| Package | What it does | Where |
| --- | --- | --- |
| `@n0tune/sdk` (TypeScript) | Public TS client + types | [packages/sdk-js](../packages/sdk-js) |
| `n0tune` (Python) | Public Python client | [packages/sdk-py](../packages/sdk-py) |
| `@n0tune/cli` | `n0tune` CLI binary | [packages/cli](../packages/cli) |
| `@n0tune/mcp-server` | The MCP server itself | [integrations/mcp-server](../integrations/mcp-server) |
| `@n0tune/vercel-ai-sdk` | Vercel AI SDK provider factory + helpers | [integrations/vercel-ai-sdk](../integrations/vercel-ai-sdk) |
| `n0tune-langchain` | LangChain `BaseRetriever` + memory tool | [integrations/langchain](../integrations/langchain) |
| `n0tune-llamaindex` | LlamaIndex `BaseRetriever` returning `NodeWithScore` | [integrations/llamaindex](../integrations/llamaindex) |
| `n0tune-markdown-folder` | Python loader for plain Markdown folders | [integrations/markdown-folder](../integrations/markdown-folder) |

### Dashboard

Next.js 15 + React 19 + Tailwind. Sidebar nav with four sections
(Start / Personalize / Run / Observe) — nine pages including the
**Context Lab** for side-by-side comparison of two users' compiled
contexts. Source: [apps/dashboard](../apps/dashboard).

## Repo layout (one screen)

```
apps/
  api/             FastAPI Gateway (Python). Routes under app/routes/,
                   services under app/services/.
  dashboard/      Next.js admin / observability UI for the Gateway.
  desktop/        Tauri 2 + React renderer.
    src-tauri/    Rust side: storage.rs (SQLite), secrets.rs (keychain),
                  lib.rs (tray + hotkey + commands).
packages/
  core/           Python — compiler.py, security.py, token primitives.
  sdk-js/         Public TS SDK.
  sdk-py/         Public Python SDK.
  cli/            `n0tune` CLI (Node mjs).
integrations/
  mcp-server/     Stdio MCP server (the 8 tools).
  vercel-ai-sdk/  Vercel AI SDK provider factory.
  langchain/      LangChain retriever + memory tool.
  llamaindex/     LlamaIndex retriever.
  markdown-folder/ Markdown-folder ingestion.
docs/
  state-of-the-project.md   You are here.
  product-direction.md      Why the project exists, framed honestly.
  how-it-works.md           Per-tool integration walkthrough.
  install.md                Pre-built installers + build-from-source.
  wire-to-claude.md         MCP wiring for Claude Code / Desktop / Cursor.
  wire-to-codex-cli.md      Codex CLI variant.
  wire-to-gemini-cli.md     Gemini CLI variant.
  context-guard.md          What Context Guard / alignment layer is.
  alignment-checker.md      The technical reference for the rule engine.
  releases/v0.1.*.md        Per-tag release notes.
scripts/
  sync-mcp-config.mjs       Keep `.mcp.json` in sync across worktrees.
  seed-dogfooding.ps1       Seed memories + index docs against a live API.
  seed-alignment-rules.py   Seed the 7 starter Context Guard rules.
.github/workflows/
  ci.yml                    Python + Node + Docker + Playwright e2e.
  release.yml               Tauri installers across Win/macOS/Linux on tag.
```

## What ships in v0.1.4

| Capability | Status |
| --- | --- |
| Context compiler with token budget + trace | ✓ shipped |
| Memory with state + decay + scope | ✓ shipped |
| Style / persona profile | ✓ shipped |
| Document indexing (chunks + embeddings + injection-risk filter) | ✓ shipped |
| Semantic cache (cosine ≥ 0.85, dependency-freshness) | ✓ shipped |
| Provider router (OpenAI / Anthropic / Gemini / OpenAI-compatible) | ✓ shipped |
| Memory consolidation (manual + auto-trigger 12-memory threshold) | ✓ shipped (v0.1.2) |
| Smarter retrieval (state weighting + type-aware decay + MMR diversity) | ✓ shipped (v0.1.3) |
| Context Guard CG-1 rule engine (6 rule types + always-on secret detector) | ✓ shipped (v0.1.3) |
| Alignment endpoints (`POST /v1/alignment/check`, `GET /v1/alignment/rules`) | ✓ shipped (v0.1.3) |
| `n0tune_alignment_check` MCP tool | ✓ shipped (v0.1.3) |
| MCP wiring (`.mcp.json` at project root, sync into sparse worktrees, notifications/initialized fix) | ✓ shipped (v0.1.4) |
| Tauri installers (unsigned) for Windows / macOS / Linux | ✓ shipped (v0.1.2+) |
| Dashboard sidebar redesign (grouped Start/Personalize/Run/Observe) | ✓ shipped (v0.1.2) |
| Desktop "mansion" redesign (six rooms + Home dashboard) | ⏳ in progress on `redesign/desktop-mansion` |
| Context Guard dashboard page (CG-3) | ⏳ not started |
| `n0tune align` CLI subcommands (CG-4) | ⏳ not started |
| Real LLM judge in alignment engine (CG-7) | ⏳ not started |
| Signed Windows + notarized macOS installers | ⏳ requires maintainer code-signing certs |

## Design language

Calm, transparent, **infrastructure-feeling**. Following the 2026
"end of visual theatrics" trend referenced in the original UX
research pass.

### Palette

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#faf9f6` (light) / `#14110d` (dark) | App background |
| `--surface` | `#ffffff` (light) / `#1d1916` (dark) | Cards, panels |
| `--line` | `#e7e5df` / `#2e2a25` | Borders, dividers |
| `--ink` | `#18130c` / `#f4eee4` | Primary text |
| `--ink-mute` | `#5b554c` / `#a39c8f` | Secondary text |
| `--accent` | `#2c4a8f` / `#94b3ef` | Links, focus rings |
| `--accent-soft` | `#e3ebf9` / `#1f2a44` | Focus halos |
| `--warn` | `#b75221` / `#e89b6f` | Warnings |
| `--field` | `#f3f1ea` / `#221d18` | Subtle fills |

Dashboard adds:

| Token | Value | Used for |
| --- | --- | --- |
| `moss` | `#47624f` | Confirmation, "ok" state |
| `moss-soft` | `#e3ece6` | Background for moss-tinted blocks |
| `rust` | `#a45735` | Attention, error pills |

### Typography

System default sans (Inter when available). Tabular numerals on
status overlays so the digits don't jitter. No giant headlines —
the system itself is what's interesting, not the marketing.

### Motion

Subtle 140ms cubic-bezier transitions on hover/focus. Animated
pipeline diagram on the Desktop Home is the only "showy" piece, and
it's there because it makes the system *legible* — you can literally
watch a message become embeddings, then retrieval, then a compiled
prompt, then a provider call.

## How to run locally

The shortest path:

```bash
git clone https://github.com/MITPOAI/N0Tune.git
cd N0Tune
cp .env.example .env

docker compose up -d --wait
curl -fsS http://localhost:8000/health   # → ok

# wire it to Claude Code
claude mcp add-json n0tune '{"command":"node","args":["./integrations/mcp-server/src/server.mjs"],"env":{"N0TUNE_API_BASE_URL":"http://localhost:8000","N0TUNE_API_KEY":"replace-with-local-development-key","N0TUNE_APP_ID":"demo","N0TUNE_USER_ID":"you"}}' --scope project

claude mcp list
# n0tune: node ./integrations/mcp-server/src/server.mjs - ✓ Connected
```

For the full guides:

- Install the desktop app — [docs/install.md](install.md)
- Wire to Claude Code / Desktop / Cursor — [docs/wire-to-claude.md](wire-to-claude.md)
- Wire to Codex CLI — [docs/wire-to-codex-cli.md](wire-to-codex-cli.md)
- Wire to Gemini CLI — [docs/wire-to-gemini-cli.md](wire-to-gemini-cli.md)
- Run the dashboard — `http://localhost:3000` after `docker compose up`

## Things that *don't* work yet (honest list)

- **Auto-running rule checks against repo docs / commits** (Context
  Guard CG-6) — the rules exist; running them against your own repo
  on every commit is a follow-up.
- **Dashboard Context Guard tab** (CG-3) — the API is live; the UI is
  not yet wired.
- **`n0tune align` CLI** (CG-4) — same: API works, CLI subcommand isn't
  there.
- **LLM-judge mode** for alignment — rules engine is deterministic;
  optional LLM second-opinion is design-only in CG-7.
- **Signed installers.** Windows SmartScreen + macOS Gatekeeper warn
  on first run. Requires the maintainer's developer certs to fix.
- **Streaming pass-through.** Current SSE fans out a resolved answer;
  upstream pass-through is a follow-up.
- **No Mac App Store / Microsoft Store** distribution. Direct GitHub
  Releases only, by design.

## License + governance

[Apache-2.0](../LICENSE). Open source. No telemetry, no analytics,
no phone-home. Bring your own provider key. Contributions welcome —
see [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md),
and [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md).

The current maintainer is the GitHub user shown on each release tag.
There is no foundation, no company, no commercial offering. **It's
just a tool.**

## What changed in the last few releases

- **v0.1.4 (2026-05-17)** — real MCP wiring (notifications/initialized
  handler + `.mcp.json` location). First green `✓ Connected` on Claude
  Code 2.x.
- **v0.1.3 (2026-05-17)** — smarter retrieval (state weighting +
  type-aware decay + MMR diversity) + Context Guard CG-1 / CG-2 /
  minimal CG-5.
- **v0.1.2 (2026-05-17)** — context-tuning headline restored, dynamic
  consolidation, cross-platform release workflow, downloadable
  installers.
- **v0.1.1 (2026-05-17)** — CI green + CLAUDE.md/AGENTS.md + UI polish.
- **v0.1.0 (2026-05-17)** — initial tag.

For the full per-release breakdown see [docs/releases/](releases/).
