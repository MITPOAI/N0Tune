# How N0Tune works

A walkthrough by **the tool you're already using**. N0Tune is armor around
those tools, not a replacement for them — find your tool below and follow
the section.

## TL;DR — what happens behind every prompt

```
your AI tool (Claude Code / Cursor / Codex CLI / Gemini CLI / …)
       │
       │  asks N0Tune to recall + compile context
       ▼
┌──────────────────────────────────────────────┐
│  N0Tune Context Compiler                     │
│  • retrieve relevant memories                │
│  • retrieve relevant file chunks             │
│  • apply your style profile                  │
│  • drop high-injection-risk chunks           │
│  • fit it all into a token budget            │
└──────────────────────────────────────────────┘
       │
       │  returns a compact, personalized prompt
       ▼
your AI tool sends that prompt to your model
       │
       ▼
model answers
       │
       ▼
N0Tune extracts new memories (if useful + safe), updates the cache
```

The model is unchanged. The **prompt** is compiled, per request, from your
local memory + style + files. That's "context-tuning" — see
[context-tuning.md](context-tuning.md).

---

## I'm using **Claude Code**

```bash
# In the repo where you want N0Tune-aware coding:
mkdir -p .claude
node packages/cli/bin/n0tune.mjs mcp install > .claude/mcp.json
```

Restart Claude Code. `/mcp` shows seven `n0tune_*` tools. In any
conversation:

> Use n0tune to remember I prefer terse code-first answers with ASCII diagrams.

Claude calls `n0tune_save_memory`. Next session:

> Use n0tune_context_preview to compile context for "explain RAG".

Returns the JSON trace showing exactly which memories + chunks would be in
your prompt. Same model. Different prompt. Personalized answer.

Full setup: [wire-to-claude.md](wire-to-claude.md).

---

## I'm using **Claude Desktop**

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["C:/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_APP_ID": "demo"
      }
    }
  }
}
```

Restart Claude Desktop. The tools icon shows seven `n0tune_*` tools.

---

## I'm using **Cursor**

Same MCP shape under `~/.cursor/cursor.config.json` (or
`%USERPROFILE%\.cursor\cursor.config.json` on Windows). See
[wire-to-claude.md](wire-to-claude.md#cursor) — Cursor is in the same doc.

---

## I'm using **Codex CLI**

Codex supports MCP. Drop the config block at the path Codex reads from
on your platform. Full walkthrough in
[wire-to-codex-cli.md](wire-to-codex-cli.md).

---

## I'm using **Gemini CLI**

Gemini CLI doesn't ship MCP support yet. Two paths:

**Adapter mode (recommended):** compile a personalized system prompt with
`n0tune compile`, then pass it to Gemini CLI:

```bash
node packages/cli/bin/n0tune.mjs compile "explain RAG" > /tmp/n0tune-prompt.txt
gemini chat --system-prompt "$(cat /tmp/n0tune-prompt.txt)" "explain RAG"
```

**Hotkey mode (fallback):** the desktop tray's global hotkey captures the
clipboard and saves it as a memory. Useful when you want N0Tune to learn
without leaving Gemini CLI.

Full walkthrough: [wire-to-gemini-cli.md](wire-to-gemini-cli.md).

---

## I'm using **ChatGPT** or **a custom OpenAI client**

Most ChatGPT-shaped clients accept a custom `OPENAI_BASE_URL`. Point it at
the Gateway:

```bash
export OPENAI_BASE_URL="http://localhost:8000/v1/openai"
export OPENAI_API_KEY="replace-with-local-development-key"
```

Now every request goes through N0Tune: the Gateway compiles a personalized
prompt, forwards to your configured upstream provider (OpenAI / Anthropic /
Gemini / Ollama / …), and returns an OpenAI-shaped response.

The response includes an `n0tune` object showing cache hit, tokens saved,
and the provider that actually answered.

---

## I'm using **plain editor / browser / nothing**

Run the Desktop:

```bash
docker compose up -d --wait   # the shared Gateway
npm --workspace apps/desktop run tauri:dev   # the Desktop tray + chat window
```

- The Desktop's **tray icon** has a *Quick remember…* menu item and a
  configurable global hotkey (`Cmd+Shift+Space` on macOS, `Alt+Space` on
  Windows/Linux). It captures the system clipboard and saves it as a
  memory without opening the window.
- The Desktop's **status overlay** (always visible in the window footer
  and the tray popover) shows tokens used this session, cache hit rate,
  active memory count, and the tailored-vs-naive prompt ratio.
- The Desktop's **chat tab** is the fallback when no other tool is open.
  It uses the same compiler + provider router as everything else.

---

## How the compiler works (the same logic everywhere)

Every path above eventually calls one of two endpoints on the Gateway:

- `POST /v1/context/preview` — compile without calling a model. Returns
  the compiled prompt + the trace.
- `POST /v1/chat` — compile + call the configured model + extract new
  memories from the answer.

Both share the same scoring loop:

1. Normalize the message.
2. Retrieve memories scored by `cosine_similarity × effective_confidence`
   (confidence decays over time unless the memory is `confirmed`).
3. Retrieve document chunks (same scoring, with prompt-injection
   downranking).
4. Apply the style profile.
5. Fit everything into the configured token budget.
6. Drop high-injection-risk chunks (≥0.7 risk score) entirely.
7. Build the compact prompt + emit a trace explaining every selection
   and exclusion.

The trace lives in `context_runs` (Gateway-side) so you can audit any
chat's context after the fact via `GET /v1/context-runs`.

## Where the model lives

**Nowhere in N0Tune.** N0Tune doesn't host, fine-tune, or modify weights.
It sends the compiled prompt to whatever endpoint you configured. See
[providers.md](providers.md) for the three wire shapes (OpenAI,
Anthropic, Gemini) and the long tail of OpenAI-compatible endpoints they
cover.

## What's not built yet (v0.1.0 work)

- **Tray + global hotkey** (Tauri 2 tray plugin). Landing in v0.1.0.
- **Status overlay** UI surface in the Desktop window + tray popover. v0.1.0.
- **Codex CLI / Gemini CLI doc pages**. v0.1.0.
- **Rust SQLite + OS keychain inside Tauri** — Today the renderer
  persists to `localStorage`. The Rust side has one `runtime_info`
  command. v0.1.0.
- **Continual-learning loop** — Memory summarization + consolidation
  (memories collapse into denser ones over time). v0.1.0.
- **Signed binaries** — You build them today via
  `npm --workspace apps/desktop run tauri:build`.

The honest status table in
[product-direction.md](product-direction.md#honest-status-board) is the
source of truth.