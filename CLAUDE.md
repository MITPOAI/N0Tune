# Claude Code guidance for N0Tune

This file is loaded automatically by Claude Code (and any tool that respects
`CLAUDE.md` / `AGENTS.md`). Read it before doing anything in this repo. It is
not a replacement for `README.md`, `docs/product-direction.md`, or
`docs/release-checklist.md` — it is the **one-page operating manual** that
keeps an agent from wandering off.

## What this project is

**N0Tune is a context-tuning system.** Fine-tune any AI, without
fine-tuning.

- Bring any model (OpenAI / Anthropic / Gemini / Qwen / OpenRouter /
  Ollama / LM Studio / OpenAI-compatible). N0Tune adds memory, persona,
  indexed files, semantic cache, and a context compiler — same model,
  personal answer.
- **Two equal surfaces:** a standalone Desktop app (Tauri, local-first,
  SQLite + OS keychain) AND an integration layer (MCP server,
  OpenAI-compatible proxy, SDKs) for tools like Claude Code that have
  their own chat UI. Both are first-class.
- Pronounced "no tune". The display wordmark is the logo; packages are
  `n0tune`, the Python module is `n0tune_core`, the CLI is `n0tune`.

## Do not

- **Do not hardcode any model or provider.** Every model name in the codebase
  is a default. Users bring their own keys via the dashboard or
  `N0TUNE_PROVIDER_DEFAULT` env. Search for `gpt-`, `claude-`, `gemini-`,
  `qwen-`, `ollama` and verify they are defaults before changing.
- **Do not target iOS / Android.** Tauri is desktop-only here (Windows,
  macOS, Linux). If you see a `cfg(target_os = "android"|"ios")` gate, it's
  dead and should be removed.
- **Do not add telemetry.** Zero telemetry is a product promise.
- **Do not put memory in the cloud by default.** Desktop persists to SQLite
  + OS keychain locally. Gateway mode persists to Postgres only when
  explicitly running the server.
- **Do not commit secrets.** `.gitleaks.toml` and `.gitleaksignore` are the
  source of truth for what's allowlisted (test fixtures, the literal
  `X-N0Tune-API-Key` header name in prose, etc.).
- **Do not bypass hooks** (`--no-verify`, `--no-gpg-sign`). If a hook fails,
  fix the underlying issue.

## Repo map (load-bearing)

```
apps/
  api/             FastAPI Gateway. Routes under app/routes/, services in app/services/.
  dashboard/       Next.js admin/observability UI for the Gateway.
  desktop/         Tauri 2 + React renderer. Windows/macOS/Linux only.
    src-tauri/     Rust side. storage.rs = SQLite (rusqlite + bundled).
                   secrets.rs = OS keychain (keyring crate).
                   lib.rs = tray + global hotkey + commands.
packages/
  core/            Python — compiler.py, security.py, token primitives.
  sdk-js/          Public TS SDK. Has a prepare script so dist/ builds on install.
  sdk-py/          Public Python SDK.
  cli/             `n0tune` CLI (mjs).
integrations/
  mcp-server/      The MCP server consumed by Claude Desktop/Code, Cursor, Codex CLI.
  vercel-ai-sdk/   TS adapter for the Vercel AI SDK ecosystem.
  langchain/       Python LangChain integration.
  llamaindex/      Python LlamaIndex integration.
  markdown-folder/ Python loader for plain Markdown folders.
docs/
  product-direction.md      Read first for "fine-tune any AI without fine-tuning" framing.
  how-it-works.md           Per-tool integration scenarios.
  wire-to-claude.md         MCP wiring for Claude Desktop / Code / Cursor.
  wire-to-codex-cli.md      MCP wiring for Codex CLI.
  wire-to-gemini-cli.md     Adapter + hotkey paths for Gemini CLI.
  release-checklist.md      Don't tag a release without running through this.
  desktop-architecture.md   Where SQLite + keychain files live per OS.
  releases/v0.1.0.md        Latest release notes draft.
.github/workflows/ci.yml    Python lint+typecheck+test + Node lint+typecheck+test+build + compose validate + Playwright e2e.
.gitleaks.toml              Allowlist for the secret scanner.
```

## Conventions

- **TypeScript:** strict mode everywhere. The `vercel-ai-sdk` workspace has
  `rootDir: src`, so consumers of `@n0tune/sdk` rely on `dist/` (built by
  the `prepare` script in `packages/sdk-js/package.json` and explicitly by
  CI). `apps/desktop` keeps a path mapping in `tsconfig.json` since it has
  no rootDir conflict.
- **Python:** ruff + mypy strict. Tests use pytest. New code follows
  `apps/api/app/services/memory/extraction.py` for shape.
- **Provider router** is the only place that calls upstream LLMs.
  Wire shapes: openai-compatible, anthropic (`/v1/messages`), gemini
  (`generateContent`). Add new providers there, not at call sites.
- **Memory consolidation** lives in
  `apps/api/app/services/memory/consolidation.py`. New summary memories
  set `replaced_by_memory_id` on the originals and flip them to
  `state="deprecated"`. Don't hard-delete originals.

## CI and release

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` must pass
  before any PR / tag. The CI workflow builds `@n0tune/sdk` first so
  workspace consumers can resolve types without path mappings.
- `docs/release-checklist.md` is the gate for tagging. Don't tag a release
  if `gh run list --branch main --limit 1` is red.
- Tags so far: `v0.1.0` (initial). Releases are signed by the maintainer,
  not by an agent. Don't sign Windows/macOS binaries — that requires the
  maintainer's developer certs.

## Useful smokes

```bash
# Top-level
npm run lint && npm run typecheck && npm test

# Single workspace
npm --workspace integrations/vercel-ai-sdk run lint

# Rust desktop
cd apps/desktop/src-tauri && cargo check

# Python API
cd apps/api && python -m pytest

# Gateway up
docker compose up -d --wait && curl -fsS http://localhost:8000/health

# Gitleaks
gitleaks detect --config .gitleaks.toml --source . --redact --verbose
```

## What to do when you're confused

1. Re-read `docs/product-direction.md`. The current framing is
   **"Fine-tune any AI, without fine-tuning"** — a context-tuning
   system with two equal surfaces (standalone Desktop + integration
   layer for other AI tools). Earlier framings ("Personal AI Runtime"
   in v0.1.0, "armor for AI tools" in v0.1.1) were over- or
   under-pivots; v0.1.2 puts the headline back on context-tuning.
2. Re-read `README.md` first 60 lines.
3. Check `docs/release-checklist.md`.
4. If still confused, ask the user — don't guess and don't reframe the
   product around your guess.
