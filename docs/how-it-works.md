# How N0Tune works today

A walkthrough of the moving parts, what's built, and what's stubbed —
written so you can answer the question "what actually happens when I send
a chat?" from memory.

## The five surfaces

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   Desktop          CLI              MCP             Gateway           │
│   (apps/desktop)   (packages/cli)   (integrations)  (apps/api)        │
│                                                                       │
└────────────────┬────────────────────────────┬─────────────────────────┘
                 │                            │
                 │  uses                      │  uses
                 │                            │
            packages/core   (Python — interfaces + extracted compiler)
            packages/sdk-*  (TS + Python clients for the Gateway API)
```

- **Desktop** runs locally. React renderer + Tauri Rust shell. Stores
  data in SQLite (planned) and uses the OS keychain for API keys
  (planned). For now the renderer talks to an in-memory stub backend so
  the UI works without Tauri prerequisites.
- **CLI** (`n0tune`) is a Node binary that wraps the Gateway HTTP API.
- **MCP** is a stdio server Claude Desktop / Claude Code / Cursor can
  launch. It exposes seven tools that map 1:1 to Gateway endpoints.
- **Gateway** is the FastAPI server with Postgres + pgvector + Redis.
  It implements the Context Compiler, semantic cache, RBAC, audit logs,
  and the OpenAI-compatible proxy.
- **Core** is the shared library Desktop and Gateway both consume so the
  compiler contract stays the same in both.

## Wiring Claude (and other providers)

The Desktop's **Provider** tab presets seven providers:

| Provider              | Base URL                                                      | Wire shape  |
| --------------------- | -------------------------------------------------------------- | ----------- |
| OpenAI                | `https://api.openai.com/v1`                                    | `openai`    |
| Anthropic Claude      | `https://api.anthropic.com`                                    | `anthropic` |
| Google Gemini         | `https://generativelanguage.googleapis.com/v1beta`             | `gemini`    |
| OpenRouter            | `https://openrouter.ai/api/v1`                                 | `openai`    |
| Ollama                | `http://localhost:11434/v1`                                    | `openai`    |
| LM Studio             | `http://localhost:1234/v1`                                     | `openai`    |
| Custom                | Any URL                                                        | `openai`    |

Pick one, paste the API key, save. The model id is configurable (the
default is the most useful current model per provider). On the Gateway
side, the same selection is `N0TUNE_PROVIDER_KIND` + `N0TUNE_PROVIDER_NAME`
+ `N0TUNE_PROVIDER_BASE_URL` + `N0TUNE_PROVIDER_API_KEY` — see
[providers.md](providers.md).

## Naming your AI

The **Persona** tab in Desktop lets you set:

- `name` — what the assistant introduces itself as in chat headers.
  Default: **Milo**. Other shipped presets in
  [`personas/`](../personas/): _Mentor_ (developer-mentor), _Studyy_
  (study-buddy), _Quill_ (writing-coach), _Pierre_ (startup-advisor).
- `personality` — a free-form sentence the compiler injects above the
  style block.
- `style` — tone / depth / format / avoid list.
- `memoryMode` — `auto` (silent saves), `review` (candidates the user
  approves), `manual` (only explicit saves), `off` (nothing carries
  between sessions).

The same fields are persisted to the style profile API on the Gateway,
so a desktop persona round-trips into the dashboard and back.

## The chat happy path

```
1.  user clicks "Send"
       │
       ▼
2.  Desktop renderer → backend.chat(message)
       │
       ▼
3.  backend compiles context:
       - normalize message
       - retrieve memories scored by similarity × confidence
       - retrieve style profile
       - retrieve relevant file/document chunks (Phase G)
       - score injection risk per chunk; drop high-risk ones
       - fit selected items into the token budget
       - assemble: system instruction + safety boundary +
         style profile + memories + chunks + user message
       │
       ▼
4.  backend calls the configured provider
       (Anthropic /v1/messages, Gemini generateContent,
        or OpenAI /chat/completions, depending on kind)
       │
       ▼
5.  backend extracts new memories from the answer (if memoryMode != off)
       │
       ▼
6.  backend updates the semantic cache so the next identical
       question can be served without re-calling the provider
       │
       ▼
7.  renderer displays the answer + an expandable trace log:
       - tokens compiled
       - tokens saved vs. a naive "stuff everything in" baseline
       - provider name
       - memories used
       - "why selected" reasons
       - any warnings (e.g. excluded high-injection-risk chunks)
```

That trace is what makes context-tuning legible. If a user asks "why did
you answer this way?" — the trace is the answer.

## Where the dashboard fits

The dashboard is the **Gateway**'s admin surface. It's not the personal
AI UI. Open it at `http://localhost:3000` after `docker compose up -d`.
The dashboard shows:

- Health of API + DB + Redis.
- Live memory list per `app_id` / `user_id` (the form fields at the top
  of every dashboard tab).
- Style profile editor.
- Document upload + chunk view (with injection-risk badges).
- Context preview — paste a question and see exactly which memories +
  chunks would feed into the compiler, plus the compiled prompt and the
  token savings estimate.
- Semantic cache contents.
- A Security tab summarizing the controls in place.

The header shows the N0Tune wordmark logo (no text title — the logo
**is** the title). The tabs scroll horizontally on narrow viewports;
header fields shrink on small screens; everything is keyboard-navigable.

## Where the CLI fits

The CLI hits the Gateway API and prints structured JSON or a status
line. It's how power users do bulk work, scripted exports, and quick
"is the system up?" checks.

- `n0tune doctor` — health + counts.
- `n0tune demo` — runs the two-user personalization scenario against the
  Gateway and prints the trace per user.
- `n0tune memory list / add / delete / export`.
- `n0tune persona export / import`.
- `n0tune files sync <folder>` — defers to `n0tune-markdown-sync`.
- `n0tune mcp install` — prints the JSON to paste into Claude Desktop /
  Cursor.

## Where MCP fits

Claude Desktop, Claude Code, and Cursor launch the MCP stdio server.
Once configured, asking Claude:

> Use N0Tune to remember that I prefer terse code-first answers.

…causes Claude to call `n0tune_save_memory` via MCP. The next time you
ask:

> Use N0Tune to recall how I like answers about RAG.

…Claude calls `n0tune_search_memories` and tailors its response with
your stored preferences. The Gateway is the shared store; the Desktop
(if running) and the MCP server both read and write the same memories.

Setup snippets for Claude Desktop, Claude Code, and Cursor live in
[mcp.md](mcp.md).

## Where the model lives

**Nowhere in N0Tune.** That's the point.

The provider router sends a small, compiled prompt to whichever model
endpoint you configured. The model weights never travel. N0Tune does
not host, fine-tune, or otherwise modify the model. See
[context-tuning.md](context-tuning.md) for the full honest version.

## What's not built yet

- **Tauri Rust commands beyond `runtime_info`.** SQLite + OS keychain
  wiring is the follow-up that turns the dev shell into a real local
  app. The React UI is built against `LocalStubBackend` in dev so all
  the screens are real and verifiable today.
- **Signed binaries.** You build your own `.exe` / `.dmg` /
  `.AppImage` via `npm --workspace apps/desktop run tauri:build`. The
  hosted release lands in Phase J.
- **Floating widget.** Planned in [floating-widget.md](floating-widget.md).
- **Local file walker in Desktop.** The walker exists in
  [`packages/core/src/n0tune_core/file_index.py`](../packages/core/src/n0tune_core/file_index.py)
  but the Desktop UI for picking a folder is part of Phase G's
  remaining work.

The honest status table in
[product-direction.md](product-direction.md#honest-status-board) is the
source of truth.
