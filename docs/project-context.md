# Project Context

N0Tune's main identity is the project folder.

When a tool opens the same folder, N0Tune can resolve the same project and
return the same project memory, sessions, and Handoff Capsules. This is the
core cross-tool workflow for Claude, Codex, Cursor, Windsurf, VS Code
assistants, desktop chat apps, and custom agents.

## Detection Inputs

Project detection uses:

1. `.n0tune/project.json` when present.
2. Git repository root.
3. Root markers: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`.
4. Fingerprint fields:
   - root path hash
   - git remote hash when available
   - package name
   - repository name
   - workspace folder name

The API stores hashes for root and remote identity. It returns the detected
root to the local caller so CLI/MCP clients can show what was detected, but
the persisted `projects` table does not need raw secrets or API keys.

## Local Config

`n0tune project init` writes:

```json
{
  "project_id": "proj_...",
  "name": "n0tune",
  "root": ".",
  "created_at": "2026-05-24T00:00:00.000Z",
  "mode": "gateway",
  "memory_policy": "review",
  "tools": {
    "claude": true,
    "codex": true,
    "cursor": true
  }
}
```

Do not store secrets in this file.

The repo `.gitignore` ignores local `.n0tune/*` files by default and allows
only `.n0tune/project.example.json` as a shareable template.

## API

```http
POST /v1/projects/detect
GET /v1/projects/{project_id}
GET /v1/projects/{project_id}/context
POST /v1/projects/{project_id}/memories
GET /v1/projects/{project_id}/memories
POST /v1/projects/{project_id}/sessions
GET /v1/projects/{project_id}/sessions
```

`GET /v1/projects/{project_id}/context` returns:

- project identity
- relevant project memories
- project-scoped documents
- latest Handoff Capsules
- current task memories

## Memory Scoping

Project memories have `project_id` set and `scope="project"`.

The context compiler does not include project memories from other projects.
When no `project_id` is supplied, project-bound shared memories are excluded
from user context to prevent cross-project leakage.

## Current Status

Implemented:

- project detection API
- `projects`, `project_tools`, `sessions`, and `handoff_capsules` tables
- project-linked memory columns
- CLI project detect/init/status
- MCP project detect/context tools
- tests for same-folder detection and project memory isolation

Planned:

- desktop-local SQLite project store
- file watcher/indexer
- configurable context pressure thresholds per model/provider
