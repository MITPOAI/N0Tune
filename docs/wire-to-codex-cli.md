# Wire N0Tune to Codex CLI

For cross-tool continuation, have Codex call:

1. `n0tune_project_detect` with the current working directory.
2. `n0tune_get_latest_handoff` for the returned project id.
3. `n0tune_get_project_context` with the user's current task.
4. `n0tune_continue_from_handoff` when a Handoff Capsule exists.

CLI fallback:

```bash
n0tune handoff continue --target codex --copy
```

[Codex CLI](https://github.com/openai/codex) is OpenAI's terminal-native
coding agent. It speaks MCP, so the wiring is the same shape as Claude
Code / Cursor — just a different config file location.

## What you'll have when this is done

- "Use N0Tune to remember X" in Codex → the Gateway stores it (after
  passing the secret detector).
- "Use n0tune_context_preview for X" → Codex sees the same compact,
  personalized prompt Claude Code or Cursor would.
- Same model. Different prompt. Personal answer.

## Prerequisites

1. **The Gateway running.** Either Docker or local uvicorn:

   ```bash
   docker compose up -d --wait
   # or, without Docker:
   cd apps/api
   N0TUNE_DATABASE_URL="sqlite+pysqlite:///./n0tune.db" \
     python -c "from app.db.session import get_engine; \
                from app.models.entities import Base; \
                Base.metadata.create_all(get_engine())"
   N0TUNE_DATABASE_URL="sqlite+pysqlite:///./n0tune.db" \
     python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Codex CLI installed** and you can run `codex` from a terminal.

3. **Node 20+** is on PATH (the MCP server is a Node script).

## Add N0Tune to your Codex MCP config

Codex reads MCP servers from `~/.codex/config.toml` (or
`%USERPROFILE%\.codex\config.toml` on Windows). Add the N0Tune block:

```toml
# ~/.codex/config.toml

[mcp_servers.n0tune]
command = "node"
args = ["C:/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs"]

  [mcp_servers.n0tune.env]
  N0TUNE_API_BASE_URL = "http://localhost:8000"
  N0TUNE_API_KEY = "replace-with-local-development-key"
  N0TUNE_APP_ID = "demo"
  N0TUNE_USER_ID = "codex"
```

> If you already have other `[mcp_servers.*]` blocks in `config.toml`,
> just add the `[mcp_servers.n0tune]` table — don't replace the file.

Or, faster — let the CLI print a config snippet for you:

```bash
node packages/cli/bin/n0tune.mjs mcp install
```

It prints the JSON shape; Codex accepts either TOML or JSON depending on
your version of `config.toml`. Pick the format Codex documents for your
release.

## Sanity check

Start a Codex session and ask it to list MCP tools:

> What MCP tools do you have access to?

You should see the seven `n0tune_*` tools listed. Then:

> Use n0tune_save_memory to remember that I prefer terse code-first
> answers with ASCII diagrams.

Codex calls the tool. The Gateway stores the memory and returns the row.

Next session:

> Use n0tune_context_preview to compile context for the question
> "explain RAG".

Codex returns the trace, which includes the memory you saved.

## Smoke from a terminal (no Codex)

Same as the Claude path. You can prove MCP works without an LLM client:

```bash
N0TUNE_API_BASE_URL=http://localhost:8000 \
N0TUNE_API_KEY=replace-with-local-development-key \
N0TUNE_APP_ID=demo \
node integrations/mcp-server/src/server.mjs <<'JSONRPC'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"n0tune_search_memories","arguments":{"user_id":"codex","query":"architecture"}}}
JSONRPC
```

Three JSON-RPC responses come back. The third is `content[0].text` — a JSON
array of matching memories.

## What Codex CLI sees

Each of the seven N0Tune tools shows up in Codex's tool picker the same way
any other MCP tool does. Codex decides when to call them — you can hint by
saying "use n0tune to …" or trust the model to invoke the right tool when
asked a question that benefits from memory.

## Security defaults

- The MCP server is stdio. **No network listener.** Only the Codex
  process that launched the server can reach it.
- The Gateway URL defaults to `localhost`. Change it deliberately if you
  host the Gateway remotely.
- `n0tune_get_persona` returns the **public** persona shell (style + memory
  mode). It does **not** include private memories.
- Memory text is checked against the Gateway's secret detector at write
  time; obvious API keys / private keys / passwords are rejected.

## Turning it off

Remove the `[mcp_servers.n0tune]` block from `~/.codex/config.toml`. The
MCP server stops getting launched. Memories you saved remain in the
Gateway until you delete them.

## See also

- [`wire-to-claude.md`](wire-to-claude.md) — same shape for Claude Desktop /
  Claude Code / Cursor.
- [`mcp.md`](mcp.md) — full MCP reference, the seven tools, security model.
- [`how-it-works.md`](how-it-works.md) — the rest of the surfaces.
