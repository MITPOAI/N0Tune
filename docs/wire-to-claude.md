# Wire N0Tune to Claude (Desktop or Code)

Step-by-step to give Claude access to your N0Tune memory. This was just
smoke-tested end-to-end against a live Gateway — the trace is in
[CHANGELOG.md](../CHANGELOG.md).

## What you'll have when this is done

When you talk to Claude (Desktop, Code, or via the API with MCP):

- "Remember I prefer X" → Claude calls `n0tune_save_memory` → the
  Gateway stores it.
- Any future question → Claude can call `n0tune_search_memories` /
  `n0tune_context_preview` and answer with your remembered context.
- The Gateway compiles a small, safety-bounded prompt around the
  retrieved memories. Same model, different prompt, personal answer.

## Prerequisites

1. **The Gateway must be running.** It's the shared store the MCP server
   reads from.

   ```bash
   docker compose up -d --wait
   # or, without Docker, point at a sqlite file:
   cd apps/api
   N0TUNE_DATABASE_URL="sqlite+pysqlite:///./n0tune.db" \
     python -c "from app.db.session import get_engine; from app.models.entities import Base; Base.metadata.create_all(get_engine())"
   N0TUNE_DATABASE_URL="sqlite+pysqlite:///./n0tune.db" \
     python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Node 20+** is installed (the MCP server is a Node script).

3. **Your Claude client supports MCP.** Claude Desktop (Anthropic),
   Claude Code, and Cursor all do.

## Claude Desktop

Edit `claude_desktop_config.json` (the file location varies — Claude
Desktop's settings UI shows the exact path):

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": [
        "C:/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs"
      ],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_APP_ID": "demo"
      }
    }
  }
}
```

Restart Claude Desktop. The hammer/tools icon should now show the seven
`n0tune_*` tools.

## Claude Code

Project-scoped (recommended — keep it inside one repo so unrelated
sessions don't see your memory):

```bash
mkdir -p .claude
cat > .claude/mcp.json <<'JSON'
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["./integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_APP_ID": "demo",
        "N0TUNE_USER_ID": "you"
      }
    }
  }
}
JSON
```

Restart the Claude Code session. The `/mcp` command should list `n0tune`
and its seven tools.

Or globally (`~/.claude/mcp.json` with the same `mcpServers` block — use
an absolute path for `args`).

## Cursor

`~/.cursor/cursor.config.json` (or
`%USERPROFILE%\.cursor\cursor.config.json` on Windows):

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["C:/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_APP_ID": "demo",
        "N0TUNE_USER_ID": "cursor_user"
      }
    }
  }
}
```

Or simpler — the CLI prints all of the above for you:

```bash
node packages/cli/bin/n0tune.mjs mcp install
```

## Smoke test from the terminal

You can verify MCP without an LLM client by feeding JSON-RPC into the
server's stdin:

```bash
N0TUNE_API_BASE_URL=http://localhost:8000 \
N0TUNE_API_KEY=replace-with-local-development-key \
N0TUNE_APP_ID=demo \
node integrations/mcp-server/src/server.mjs <<'JSONRPC'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"n0tune_search_memories","arguments":{"user_id":"you","query":"architecture"}}}
JSONRPC
```

Expected: three JSON-RPC responses. The third is `content[0].text` =
a JSON array of matching memories.

## First conversation that proves it

In your MCP-enabled Claude:

> Use the n0tune tool to remember that I prefer terse code-first answers
> with ASCII diagrams.

Claude calls `n0tune_save_memory`. The Gateway stores it (and refuses if
the text looks like a secret). Then:

> Use n0tune_context_preview to see how you'd answer "Walk me through
> RAG" for me.

Claude returns the compiled context — the same prompt the chat endpoint
would build before calling the LLM. You'll see your saved memory in the
selected list. Same model, different prompt.

## Security defaults

- The MCP server is stdio. **No network listener.** Your tools are only
  reachable by the client that launched the process.
- The Gateway URL defaults to localhost. You can host it remotely if
  you want, but you control that boundary.
- `n0tune_get_persona` returns the **public** persona shell — name,
  style, memory mode. It does **not** include private memories.
- Memory text is checked against the Gateway's secret detector at write
  time; obvious API keys / private keys / passwords are rejected.

## Turning it off

Stop running the Gateway, or remove the `n0tune` entry from your
MCP config. The MCP server is inert until the client launches it; you
can revoke access just by deleting the config block.
