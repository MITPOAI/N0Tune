# Agent guidance for N0Tune

`AGENTS.md` is the cross-tool standard ([agents.md](https://agents.md)) read
by Codex CLI, Cursor, Aider, Continue, and most other coding agents.
Claude Code reads `CLAUDE.md` first — but the content is the same, so if
you're a non-Claude agent, **read this file**.

The full operating manual lives in [`CLAUDE.md`](CLAUDE.md). The
abbreviated rules below are what every agent must respect.

## Project in one line

N0Tune is a **context-tuning system** — fine-tune any AI, without
fine-tuning. Bring any model. N0Tune adds local memory, a persona
profile, indexed files, semantic cache, and a context compiler. Same
model, personal answer. Consumable as a standalone Desktop app or as an
integration layer (MCP / OpenAI-compatible proxy / SDKs) under Claude
Code, Cursor, Codex CLI, etc.

## Hard rules

- **No hardcoded model or provider.** Every model name is a default,
  configurable by the user.
- **Desktop is Windows/macOS/Linux only.** Do not add iOS or Android code.
  Tauri's mobile cfg gates have been removed.
- **No telemetry.** Zero telemetry is a product promise.
- **Local-first.** Desktop persists to SQLite + OS keychain. Gateway mode
  persists to Postgres only when the server is explicitly running.
- **No secrets in commits.** `.gitleaks.toml` is the allowlist source of
  truth.
- **No bypassing hooks** (`--no-verify` etc.). Fix the root cause.

## Where things live

| Concern                          | Path                                                |
| -------------------------------- | --------------------------------------------------- |
| Product direction (read first)   | `docs/product-direction.md`                         |
| Per-tool integration scenarios   | `docs/how-it-works.md`                              |
| MCP wiring docs                  | `docs/wire-to-claude.md`, `docs/wire-to-codex-cli.md`, `docs/wire-to-gemini-cli.md` |
| Release gate                     | `docs/release-checklist.md`                         |
| Gateway API                      | `apps/api/`                                         |
| Dashboard                        | `apps/dashboard/`                                   |
| Desktop renderer                 | `apps/desktop/src/`                                 |
| Desktop Rust (SQLite, keychain, tray, hotkey) | `apps/desktop/src-tauri/src/`              |
| MCP server                       | `integrations/mcp-server/`                          |
| Provider router (single source)  | `apps/api/app/services/providers/router.py`         |
| Memory consolidation             | `apps/api/app/services/memory/consolidation.py`     |
| Context compiler (shared)        | `packages/core/src/n0tune_core/compiler.py`         |

## Required pre-PR checks

```bash
npm run lint
npm run typecheck
npm test
```

Python side:

```bash
ruff check apps/api packages/core packages/sdk-py integrations/langchain integrations/llamaindex integrations/markdown-folder
mypy apps/api/app packages/core/src packages/sdk-py/src integrations/langchain/src integrations/llamaindex/src integrations/markdown-folder/src
pytest apps/api/app/tests packages/core/tests packages/sdk-py/tests integrations/langchain/tests integrations/llamaindex/tests integrations/markdown-folder/tests
```

CI is the source of truth — see `.github/workflows/ci.yml`.

## Commit conventions

- Short, descriptive subject. No emoji.
- Body wrapped at ~72 chars. Explain the *why*.
- Trailing `Co-Authored-By:` line is fine if you're an agent.
- Never amend a published commit; create a new one.
- Don't push to `main` without explicit user authorization.

## When you don't know

Don't guess. Ask the user. The project's current framing is
**"Fine-tune any AI, without fine-tuning"** — a context-tuning system
with two equal surfaces (standalone Desktop + integration layer for
other AI tools). Earlier framings ("Personal AI Runtime", "armor for
AI tools") were too narrow on one side or the other; current docs put
context-tuning back at the headline. If your mental model doesn't match
the README's first paragraph, you're working from stale context.
