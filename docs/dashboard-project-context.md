# Dashboard Project Context

The dashboard is now project-first.

## Command Center

Command Center leads with:

- current detected project
- project memory count
- Handoff Capsule count
- connected Gateway health
- context preview
- MCP and CLI-ready actions

Hero copy:

> Same project. Same memory. Any AI tool.

## Sessions

The Sessions page shows two data sources:

- project sessions from `/v1/projects/{project_id}/sessions`
- context runs from `/v1/context-runs`

Project sessions are the durable cross-tool rows. Context runs are compiler
telemetry and token estimates.

## Handoff Capsules

The Handoff page reads real capsules from:

```http
GET /v1/projects/{project_id}/handoffs
```

The `Continue in Codex` button calls:

```http
POST /v1/handoffs/{handoff_id}/continue-prompt
```

If no capsules exist, the page says so and gives the CLI/MCP paths. It does
not show fake completed capsules.

## MCP And Plugins

The MCP page lists the live project-context tools:

- project detection
- project context
- project memory
- Handoff Capsule create/list/latest/continue

## Current Limitations

- The browser cannot know an arbitrary editor working directory. The
  dashboard detects the Gateway process project root using `cwd="."`.
- A dashboard create form for Handoff Capsules is planned; API, CLI, and MCP
  creation already work.
- Desktop-local project state will use SQLite later.
