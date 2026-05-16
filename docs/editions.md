# Editions

N0Tune ships in one repo. Five surfaces, ranked by **how they serve the
"armor" goal** (augment the AI tools you already use, don't replace them).

## Summary

| #  | Edition           | What it does for you                                                          |
| -- | ----------------- | ----------------------------------------------------------------------------- |
| 1  | **MCP server**    | Lets Claude Code / Claude Desktop / Cursor / Codex CLI read & write your memory. **This is the headline path.** |
| 2  | **Gateway**       | The server backing MCP + the OpenAI-compatible proxy + the SDKs.              |
| 3  | **Desktop**      | Tray icon + global hotkey + status overlay. Cross-tool memory capture. Chat is a fallback. |
| 4  | **CLI**          | `n0tune doctor / demo / memory / persona / files / mcp install / compile`.    |
| 5  | **Core**          | The compiler + interfaces library both Desktop's Rust side and the Gateway consume. |

Notice the ranking: MCP is #1 because that's how N0Tune most often *actually*
adds value. Desktop sits at #3 because its primary value is the **tray +
hotkey + overlay** — not chat.

## #1 — MCP server (`integrations/mcp-server`)

**Who:** anyone using Claude Desktop, Claude Code, Cursor, Codex CLI, or
another MCP-capable agent tool.

**What:** a stdio server with seven tools that hit the Gateway:

- `n0tune_search_memories`
- `n0tune_save_memory`
- `n0tune_get_style_profile`
- `n0tune_search_docs`
- `n0tune_context_preview`
- `n0tune_forget_memory`
- `n0tune_get_persona`

**Status:** shipped. See [`mcp.md`](mcp.md), [`wire-to-claude.md`](wire-to-claude.md),
[`wire-to-codex-cli.md`](wire-to-codex-cli.md).

**Why it's #1:** your existing AI tool already has the chat UI you want.
You just want it to remember things and tailor its answers. MCP does that
with one config file edit.

## #2 — Gateway (`apps/api`)

**Who:** developers and teams who want a shared N0Tune for a whole team, a
self-hosted deployment, or to embed N0Tune behind their own product.

**What:** FastAPI server with Postgres + pgvector + Redis. Implements the
Context Compiler, semantic cache, RBAC, audit logs, prompt-injection
scoring, rate limiting, and the OpenAI-compatible proxy at
`/v1/openai/chat/completions`.

**Status:** shipped and the most mature surface.

**Why it's #2:** even when you talk to N0Tune via MCP, the Gateway is the
store the tools read from. It's also the right shape for "I want a team
N0Tune."

## #3 — Desktop (`apps/desktop`)

**Who:** anyone who wants N0Tune visible while they work in tools that
don't speak MCP, or who wants a quick way to capture memories from any
window.

**What:**

- **Tray icon** — sits in the menu bar / system tray. Quick remember,
  open dashboard, status peek.
- **Global hotkey** — `Cmd+Shift+Space` / `Alt+Space` captures the
  clipboard or selection and saves it as a memory.
- **Status overlay** — visible counters: tokens used this session, cache
  hit rate, active memory count, tailored-vs-naive prompt ratio.
- **Fallback chat** — a tab in the main window. Uses the same compiler.
  This is *not* the headline; it exists so the app is useful in isolation.

**Status:** React shell + real provider calls + localStorage shipped.
Tray + hotkey + status overlay + Rust SQLite + OS keychain land in v0.1.0.

**Why it's #3:** the chat is a fallback. The valuable thing is the
**ambient surface** — the tray and the overlay let N0Tune be visible
across every tool, not just inside one.

## #4 — CLI (`packages/cli`)

**Who:** developers, demo-givers, scripters.

**What:** a Node binary `n0tune`. Subcommands:

- `doctor` — Gateway + DB + Redis + provider health.
- `demo` — two-user personalization scenario.
- `memory list / add / delete / export / consolidate`.
- `persona export / import`.
- `files sync` — delegates to `n0tune-markdown-sync`.
- `compile <message>` — return the compiled context as plain text (lands in
  v0.1.0, used by the Gemini CLI adapter).
- `mcp install` — print Claude Desktop / Code / Cursor MCP config snippets.

**Status:** scaffold + the listed subcommands. `init`, `desktop start`,
`gateway start` print honest "coming next."

**Why it's #4:** indispensable for setup and dogfooding, but most users
won't open it daily.

## #5 — Core (`packages/core`)

**Who:** engineers building on N0Tune. The Gateway uses this directly.
The Desktop's Rust side will use it once the SQLite layer lands.

**What:** Python package with:

- `interfaces.py` — `MemoryStore`, `StyleStore`, `DocumentStore`,
  `ProviderRouter`, `ContextCompiler`, `SecurityScanner`, `CacheStore`
  Protocols.
- `compiler.py` — extracted token-budget-aware compiler.
- `lexical.py` — pure-Python BM25 helper.
- `security.py` — prompt-injection scoring + secret detection.
- `tokens.py` — token estimator.
- `file_index.py` — folder walker and chunker.

**Status:** shipped. 20+ tests in `packages/core/tests/`.

**Why it's #5:** library, not a UI. Crucial but quiet.

## Which one should you use?

| You want…                                          | Use                                            |
| -------------------------------------------------- | ---------------------------------------------- |
| Claude Code / Cursor / Claude Desktop to remember  | MCP + Gateway                                  |
| Codex CLI to remember                              | MCP + Gateway. See [wire-to-codex-cli.md](wire-to-codex-cli.md). |
| Gemini CLI to use my N0Tune context                | CLI `compile` + Gateway. See [wire-to-gemini-cli.md](wire-to-gemini-cli.md). |
| ChatGPT / any OpenAI client to use my context      | Point `OPENAI_BASE_URL` at the Gateway proxy.  |
| To capture memories from any editor / browser      | Desktop tray + global hotkey.                  |
| A team N0Tune behind a shared service              | Gateway with Postgres + Redis.                 |
| To embed N0Tune in my own app                      | Core + SDKs.                                   |

## What stays the same across editions

- The Context Compiler contract (system prompt + safety boundary + style +
  memories + chunks + user message).
- The memory shape (state, scope, confidence, decay).
- The security policy (memory secret rejection, prompt-injection scoring,
  multi-tenant scoping).
- The observable trace (`context_runs` table on Gateway, identical JSON
  shape returned by the SDKs and MCP).

If a contract changes, it changes everywhere at once — by intent.