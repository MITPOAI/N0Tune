# MCP server

N0Tune ships a stdio MCP server in
[`integrations/mcp-server`](../integrations/mcp-server/). Run it locally and
any MCP-compatible client — Claude Desktop, Claude Code, Cursor — can read
and write your N0Tune memory.

## Run

```bash
node integrations/mcp-server/src/server.mjs
```

It speaks the MCP protocol over stdin/stdout, so don't invoke it directly
from a terminal you want to type into — the client launches it for you.

### Environment

```bash
N0TUNE_API_BASE_URL=http://localhost:8000   # where the Gateway is reachable
N0TUNE_APP_ID=demo                          # which app to scope to
N0TUNE_API_KEY=replace-with-local-development-key
```

The server defaults are sensible for `docker compose up` on the same
machine.

## Tools

| Tool                       | What                                                   |
| -------------------------- | ------------------------------------------------------ |
| `n0tune_search_memories`   | Vector search a user's memories.                       |
| `n0tune_save_memory`       | Save a memory (secrets are rejected at the API).       |
| `n0tune_get_style_profile` | Read the user's compact style profile.                 |
| `n0tune_search_docs`       | Search indexed documents and chunks.                   |
| `n0tune_context_preview`   | Compile a context without calling a model.             |
| `n0tune_forget_memory`     | Soft-delete a memory.                                  |
| `n0tune_get_persona`       | Read the public persona shell (style + memory mode).   |

`n0tune_get_persona` **does not** include private memories. It returns the
same shape `n0tune persona export` produces — safe to share with another
agent.

## Claude Desktop

Add this to `claude_desktop_config.json` (location varies by OS — see
Anthropic's docs):

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["./integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_APP_ID": "demo",
        "N0TUNE_API_KEY": "replace-with-local-development-key"
      }
    }
  }
}
```

After saving and restarting Claude Desktop, the seven tools above appear in
the tool picker. The CLI prints this snippet for you:

```bash
n0tune mcp install
```

## Claude Code

Same `mcpServers` shape lives in the project-scoped or user-scoped Claude
Code config. The recommended path is project-scoped so the MCP server only
runs in repos that want it:

```bash
# In the root of a repo that should see your N0Tune memory:
mkdir -p .claude
cat > .claude/mcp.json <<'JSON'
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["./integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_APP_ID": "demo"
      }
    }
  }
}
JSON
```

(Adjust the path if you've installed N0Tune outside the project.)

## Cursor

Cursor accepts the same shape via `~/.cursor/cursor.config.json` (or
`%USERPROFILE%\.cursor\cursor.config.json` on Windows):

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_APP_ID": "demo",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_USER_ID": "cursor_user"
      }
    }
  }
}
```

Cursor's MCP picker should list every N0Tune tool. Try:

> Use N0Tune to remember that I prefer ASCII diagrams over emoji-heavy
> outputs.

The agent calls `n0tune_save_memory`, the Gateway stores it (with the
secret detector running over the text), and the next chat sees the
preference through context preview.

## Codex / generic MCP clients

Any MCP client following the spec works. Point its server config at
`node ./integrations/mcp-server/src/server.mjs` with the same `env` block
shown above. The MCP server speaks Protocol Version `2024-11-05`.

## Security defaults

- **Local-only.** The MCP server is stdio. There's no network listener
  unless you put one in front of it on purpose.
- **API key never appears in tool input or output.** The server reads it
  from the environment and forwards via header.
- **Persona export omits private memory.** Use
  `n0tune_search_memories` with an explicit user-id when you really want
  the memory contents to travel.
- **No shell execution.** No tool runs arbitrary commands; every tool
  maps 1:1 to a Gateway endpoint.

## Disabling MCP

Don't run the server. The tools are inert until the client launches it.
On the Gateway side, no MCP-specific endpoint exists — every MCP tool
hits the same routes the Dashboard and SDKs use.

## Tests

[`integrations/mcp-server/tests/server.test.mjs`](../integrations/mcp-server/tests/server.test.mjs)
asserts the tool list. End-to-end MCP testing belongs in the agent
client; we don't ship our own MCP test harness.
