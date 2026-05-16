# Product direction

N0Tune is **armor for the AI tools you already use** — Claude Code, Claude
Desktop, Cursor, Codex CLI, Gemini CLI, ChatGPT — not a replacement chat app.
This page captures the framing so contributors and users know exactly what
N0Tune is for.

## The one-line pitch

**Armor for your AI tools.** Local memory, token-savings, and tailored
context for any model you choose. Same model, same question, personalized
answer, fewer tokens, no fine-tuning.

## Armor not warrior

An earlier pivot framed N0Tune as a "Personal AI Runtime" with a downloadable
chat app. That was wrong. People already have Claude Code, Cursor, Codex CLI,
ChatGPT — they don't want another chat. They want their existing tools to
feel personal.

So N0Tune is shaped as **armor**:

- **MCP server** — Claude Desktop, Claude Code, Cursor, Codex CLI all support
  MCP. The N0Tune MCP server exposes seven tools to read/write memories,
  style, persona, and search the local document index. From inside your
  existing tool you say "use n0tune to remember…" and it works.
- **OpenAI-compatible proxy** — clients that don't speak MCP but accept a
  custom `OPENAI_BASE_URL` (most "ChatGPT-shaped" tools) get the same context
  injection by pointing at `http://localhost:8000/v1/openai`.
- **Tray + global hotkey** — for any other tool (Gemini CLI, vim, a text
  editor, the browser), the desktop tray gives you a global hotkey that
  captures the clipboard or selection and saves it as a memory.
- **Status overlay** — a small panel that shows live counters: tokens used,
  cache hit rate, active memory count, the tailored-vs-naive prompt ratio.
  Visible from the tray.
- **Fallback chat** — when nothing else is open, the Desktop window has a
  chat tab that uses the same memory + compiler. This is *not* the point. It
  exists so the app is useful in isolation.

## How N0Tune works for each scenario

| Scenario                                                       | Path                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Coding in Claude Code                                          | MCP — add `n0tune` to project `.claude/mcp.json`. 7 tools available in `/mcp`.     |
| Chatting in Claude Desktop                                     | MCP — add `n0tune` to `claude_desktop_config.json`. Restart Claude Desktop.        |
| Coding in Cursor                                               | MCP — same JSON shape in `~/.cursor/cursor.config.json`.                            |
| Coding in Codex CLI                                            | MCP — see [`docs/wire-to-codex-cli.md`](wire-to-codex-cli.md).                      |
| Coding with Gemini CLI                                         | Compiled-prompt adapter — see [`docs/wire-to-gemini-cli.md`](wire-to-gemini-cli.md).|
| Using ChatGPT / OpenAI SDK / IDE that wants a base URL         | Point `OPENAI_BASE_URL` at `http://localhost:8000/v1/openai`.                       |
| Plain editor / browser / vim                                   | Tray global hotkey captures selection → saves memory. Recall on next chat.          |
| Nothing else open                                              | Desktop window chat — fallback only.                                                 |

## The original promise

The pitch — *tailor context, save tokens, run quicker, tune without
fine-tuning* — is the same. The shape of the product is what changed.
Today N0Tune ships:

- **Tailor context**: the Context Compiler picks memories + chunks + style
  per request, fits them in a token budget, and writes a small prompt.
- **Save tokens**: the compiled prompt is much smaller than a naive "stuff
  everything in" baseline. Reproducible 17.4% on the seeded eval
  ([benchmarks.md](benchmarks.md)); higher with real embeddings.
- **Run quicker**: semantic cache returns answers to repeated questions
  without round-tripping to the provider.
- **Tune without fine-tuning**: the model weights never change. Memory +
  style + files do all the personalization, in the prompt.

## The five editions

N0Tune is one project with five surfaces:

| Edition          | Audience                                    | Status                                                              |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| **MCP server**   | Anyone using an MCP-capable AI tool         | Shipped. Seven tools. See [editions.md](editions.md).               |
| **Gateway**      | Developers and teams                        | Shipped. FastAPI + Postgres + pgvector + Redis.                     |
| **Desktop**     | Tray icon + status overlay + fallback chat  | Tray + hotkey + overlay land in v0.1.0. Rust SQLite/keychain follow. |
| **CLI**         | Power users + scripting                     | `n0tune doctor / demo / memory / persona / files / mcp install`.    |
| **Core**         | Library used by Desktop + Gateway           | Shipped. Context Compiler + interfaces.                              |

See [editions.md](editions.md) for the full rundown.

## What N0Tune is

- An augmentation layer for existing AI tools.
- A local-first AI memory layer.
- A context compiler.
- A token-savings + cache instrumentation surface.
- A continual-learning loop (memory consolidation in v0.1.0).
- A desktop tray + global hotkey for cross-tool memory capture.
- An MCP server, an OpenAI-compatible proxy, and a Python/TS SDK.
- Open-source, Apache-2.0, no telemetry.

## What N0Tune is **not**

- Not a model.
- Not a fine-tuning service.
- Not a hosted model provider.
- **Not a replacement for Claude Code / Cursor / Codex CLI / etc.**
- Not a secret manager (the memory layer rejects secrets, never stores them).
- Not a guarantee against hallucinations.
- Not a system that stores private memory in the cloud by default.

## Hardcoded models?

No. Audited and confirmed. Every provider/model reference in the codebase is
a **default** (in `apps/desktop/src/components/Onboarding.tsx`,
`apps/desktop/src/components/ProviderSettings.tsx`, `apps/api/app/config.py`)
— users replace freely. The provider router supports three wire shapes
(`openai`, `anthropic`, `gemini`); the first covers OpenAI, OpenRouter,
Ollama, LM Studio, vLLM, and any OpenAI-compatible endpoint.

## Honest status board

| Capability                              | Status                                          |
| --------------------------------------- | ----------------------------------------------- |
| Context Compiler                        | ✅ shipped (Gateway-side, ~17 % token savings) |
| Memory with state + decay               | ✅ shipped                                      |
| RAG / document chunks                   | ✅ shipped                                      |
| Semantic cache                          | ✅ shipped                                      |
| OpenAI-compatible proxy + SSE streaming | ✅ shipped                                      |
| MCP server (7 tools)                    | ✅ shipped                                      |
| OpenAI / OpenAI-compatible provider     | ✅ shipped                                      |
| Anthropic Claude provider               | ✅ shipped (Messages API)                       |
| Gemini provider                         | ✅ shipped (generateContent REST)               |
| OpenRouter / Qwen / Ollama / LM Studio  | ✅ shipped (via OpenAI-compatible path)         |
| Desktop chat (fallback)                 | ✅ shipped (real provider calls + localStorage) |
| Desktop tray + global hotkey            | 🟡 v0.1.0 work                                  |
| Status overlay (tokens / cache)         | 🟡 v0.1.0 work                                  |
| Codex CLI wiring docs                   | 🟡 v0.1.0 work                                  |
| Gemini CLI adapter                      | 🟡 v0.1.0 work                                  |
| Rust SQLite + OS keychain               | 🟡 v0.1.0 work                                  |
| Continual learning / consolidation      | 🟡 v0.1.0 work                                  |
| Signed installers                       | 🟴 follow-up (you build them today)            |

If anything elsewhere in the docs disagrees with the table above, this table
wins.