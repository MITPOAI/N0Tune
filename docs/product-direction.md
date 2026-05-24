# Product direction

Current headline:

**Keep context across Claude, Codex, Cursor, and every AI tool.**

N0Tune is an open-source shared context layer for AI tools. The project
folder is the identity: same project, same memory, any AI tool. The
context-tuning system remains true, but the product now leads with
cross-tool project continuity instead of token savings or generic memory.

N0Tune is a **context-tuning system**: it gives any AI model your personal
context — memories, persona, indexed files — *without* fine-tuning the model.
Same model, same question, personal answer. This page captures the framing
so contributors and users know exactly what N0Tune is for.

## The one-line pitch

**Fine-tune any AI. Without fine-tuning.**

Bring your model. N0Tune adds local memory, a persona profile, indexed
files, semantic cache, and a context compiler. Same model. Personal
answer. No GPU, no training data, no per-provider lock-in.

## Two surfaces of one system

The point is the context-tuning system. Where you *consume* it is up to
you — N0Tune is shipped on both fronts equally:

**Standalone (Desktop + Gateway).**
The N0Tune Desktop is a real downloadable app: tray, global hotkey,
status overlay, chat, persona settings, memory viewer, context preview.
It writes to a local SQLite DB and an OS-native keychain — no cloud by
default. Use the Desktop as your primary AI chat surface and you get a
genuinely personal AI on your machine.

**As an integration layer.**
Already living inside Claude Code, Cursor, Codex CLI, or any
OpenAI-compatible client? Wire N0Tune in via MCP (seven tools) or via
the OpenAI-compatible proxy (`/v1/openai/chat/completions`). Your
existing AI tool calls N0Tune for memory + context; you get
personalization without changing tools.

Both surfaces share the same memory + persona + cache + compiler. A
memory you save from the Desktop quick-remember overlay is the same
memory Claude Code retrieves via MCP.

## What the system actually does, per request

1. **Embed** the user's message into a vector (default `hash`, optional
   OpenAI-compatible embeddings, optional local `fastembed`).
2. **Retrieve** the most relevant memories + file chunks for that user
   (hybrid vector + lexical score, configurable weight).
3. **Apply** the user's persona / style profile.
4. **Check** the semantic cache — if a near-identical prompt was seen and
   none of the dependencies (memory, doc, style) changed, return the
   cached answer.
5. **Compile** memories + chunks + style + safety boundary into a compact
   prompt that fits the token budget, with a trace of why each item was
   selected.
6. **Route** the compiled prompt to your configured provider (OpenAI /
   Anthropic / Gemini / OpenAI-compatible).
7. **Learn** — promising user-stated preferences are extracted into new
   memories; similar memories are consolidated into denser summaries
   over time.

The model never knows N0Tune is in the loop. It receives a normal prompt
with useful context.

## How you consume N0Tune

| You want…                                                    | Path                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| A standalone personal AI chat on your machine                | **N0Tune Desktop** — install the Tauri app, configure provider, chat.              |
| Personalization inside Claude Code                           | **MCP** — add `n0tune` to project `.claude/mcp.json`. 7 tools available in `/mcp`. |
| Personalization inside Claude Desktop                        | **MCP** — add `n0tune` to `claude_desktop_config.json`. Restart Claude Desktop.    |
| Personalization inside Cursor                                | **MCP** — same JSON shape in `~/.cursor/cursor.config.json`.                       |
| Personalization inside Codex CLI                             | **MCP** — see [`wire-to-codex-cli.md`](wire-to-codex-cli.md).                       |
| Personalization inside Gemini CLI                            | **Adapter** — `n0tune compile` (or the desktop hotkey) — see [`wire-to-gemini-cli.md`](wire-to-gemini-cli.md). |
| Plug into ChatGPT-style tools that accept a base URL         | **Proxy** — point `OPENAI_BASE_URL` at `http://localhost:8000/v1/openai`.           |
| Build a team app / multi-user backend                        | **Gateway** — run the FastAPI server; use the dashboard, audit logs, RBAC.          |
| Integrate from your own code                                 | **SDKs** — Python (`n0tune`), TypeScript (`@n0tune/sdk`); LangChain / LlamaIndex / Vercel adapters. |

Every path uses the same context-tuning system underneath. Memories
saved from one surface are visible from every other surface.

## The original promise

The pitch — *tailor context, save tokens, run quicker, tune without
fine-tuning* — is the same as day one. Today N0Tune ships every piece:

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

- A **context-tuning system** for any AI model (no GPU, no training data).
- A local-first AI **memory** layer (vector + lexical hybrid retrieval).
- A **persona** profile that shapes tone, depth, format, things to avoid.
- A **document index** (chunking + embedding + RAG) over your folders.
- A **semantic cache** that reuses answers across similar prompts.
- A **context compiler** that fits memory + chunks + persona into a token budget.
- A **continual-learning loop** that consolidates similar memories over time.
- A **provider router** for OpenAI / Anthropic / Gemini / OpenAI-compatible.
- A **Desktop app**, an **MCP server**, an **OpenAI-compatible proxy**, a
  **CLI**, and Python + TypeScript **SDKs** — all consuming the same system.
- Open-source, Apache-2.0, **zero telemetry**.

## What N0Tune is **not**

- Not a model.
- Not a fine-tuning service.
- Not a hosted model provider.
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
