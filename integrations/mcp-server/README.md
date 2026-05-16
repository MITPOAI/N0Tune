# N0Tune MCP server

The MCP server is a stdio JSON-RPC server that calls the local N0Tune API.

Run:

```powershell
node integrations/mcp-server/src/server.mjs
```

Environment:

```powershell
$env:N0TUNE_API_BASE_URL = "http://localhost:8000"
$env:N0TUNE_APP_ID = "demo"
$env:N0TUNE_API_KEY = "replace-with-local-development-key"
```

Tools:

- `n0tune_search_memories`
- `n0tune_save_memory`
- `n0tune_get_style_profile`
- `n0tune_search_docs`
- `n0tune_context_preview`
- `n0tune_forget_memory`

Claude Desktop style config:

```json
{
  "mcpServers": {
    "n0tune": {
      "command": "node",
      "args": ["C:/Dev/IMME internal/N0Tune/integrations/mcp-server/src/server.mjs"],
      "env": {
        "N0TUNE_API_BASE_URL": "http://localhost:8000",
        "N0TUNE_APP_ID": "demo"
      }
    }
  }
}
```
