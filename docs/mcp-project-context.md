# MCP Project Context

MCP is the primary way AI tools share N0Tune project context.

The MCP server is local-only by default. It talks to `http://localhost:8000`
unless configured otherwise, never exposes API keys as tool output, and does
not execute shell commands.

## Project Tools

| Tool | Purpose |
| --- | --- |
| `n0tune_project_detect` | Detect/register a project from `cwd`. |
| `n0tune_get_project_context` | Get scoped memories, docs, handoffs, and tasks. |
| `n0tune_create_handoff_capsule` | Save a capsule for another tool. |
| `n0tune_get_latest_handoff` | Read the latest capsule for the project. |
| `n0tune_list_handoffs` | List recent capsules. |
| `n0tune_continue_from_handoff` | Generate a continuation prompt. |
| `n0tune_save_project_memory` | Save project-scoped memory. |
| `n0tune_search_project_memory` | Search only the selected project. |

Existing memory/style/docs/context tools remain available for user-level
personalization.

## Example Claude Or Codex Flow

```json
{
  "cwd": "C:/Dev/IMME internal/N0Tune",
  "tool_name": "codex"
}
```

Call order:

1. `n0tune_project_detect`
2. `n0tune_get_project_context`
3. `n0tune_get_latest_handoff`
4. `n0tune_continue_from_handoff`

## Safety Rules

- Default Gateway URL must be localhost, `127.0.0.1`, or `::1`.
- Set `N0TUNE_MCP_ALLOW_REMOTE=1` only when intentionally using a remote
  Gateway.
- Tools are project-scoped by `project_id`.
- Project-memory search does not query all projects.
- No shell execution is exposed through MCP.
- API keys are read from environment variables only and are never returned in
  tool results.

## Config

Claude Desktop and Cursor use the same stdio shape:

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["./integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_API_KEY": "replace-with-local-development-key",
        "N0TUNE_APP_ID": "demo",
        "N0TUNE_USER_ID": "claude"
      }
    }
  }
}
```
