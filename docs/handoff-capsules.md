# Handoff Capsules

Handoff Capsules are the core cross-tool continuation object in N0Tune.

They replace manual "here is what I did" handoff docs when a Claude,
Codex, Cursor, or custom-agent session is getting long, near a usage limit,
or ready to move to another tool.

## What A Capsule Stores

A capsule stores:

- title
- project id
- source tool
- optional target tool
- goal
- current state
- decisions
- files changed
- commands run
- errors seen
- tests run
- next steps
- open questions
- warnings
- memory references
- document references

## API

```http
POST /v1/projects/{project_id}/handoffs
GET /v1/projects/{project_id}/handoffs
GET /v1/handoffs/{handoff_id}
POST /v1/handoffs/{handoff_id}/continue-prompt
DELETE /v1/handoffs/{handoff_id}
```

Create example:

```json
{
  "app_id": "demo",
  "source_tool": "claude",
  "target_tool": "codex",
  "goal": "Finish project-context MCP tools.",
  "current_state": "Claude added project detection and handoff API routes.",
  "decisions": ["Project folder identity is the source of truth."],
  "files_changed": ["apps/api/app/routes/projects.py"],
  "commands_run": ["pytest apps/api/app/tests/test_project_context.py"],
  "next_steps": ["Run MCP tests.", "Update CLI docs."]
}
```

Continuation prompt:

```bash
n0tune handoff continue --target codex --copy
```

The generated prompt includes the source tool, project id, goal, current
state, decisions, files changed, commands, tests, next steps, open questions,
and warnings.

## MCP Tools

- `n0tune_create_handoff_capsule`
- `n0tune_get_latest_handoff`
- `n0tune_list_handoffs`
- `n0tune_continue_from_handoff`

## CLI Commands

- `n0tune handoff create --source claude --target codex "..."`
- `n0tune handoff latest`
- `n0tune handoff latest --copy`
- `n0tune handoff continue --target codex --copy`

## Current Status

Implemented:

- database model and migration
- create/list/get/archive endpoints
- continuation prompt generation
- CLI latest/continue fallback
- MCP create/latest/list/continue tools
- API test proving Claude-to-Codex continuation prompt contents

Planned:

- automatic summarization from full transcript history
- provider-specific context-window thresholds
- dashboard create form
