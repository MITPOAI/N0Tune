# Cross-Tool Workflows

N0Tune's main product story is cross-tool project continuity:

> Same project. Same memory. Any AI tool.

## Workflow A: Claude To Codex

1. User opens a project folder.
2. User starts Claude Code.
3. Claude uses N0Tune MCP.
4. N0Tune detects the project from `cwd`.
5. Claude works on the task.
6. The session gets long or the user chooses to hand off.
7. Claude or the user creates a Handoff Capsule.
8. User opens Codex in the same folder.
9. Codex calls:
   - `n0tune_project_detect`
   - `n0tune_get_latest_handoff`
   - `n0tune_get_project_context`
10. Codex continues from the capsule.

CLI fallback:

```bash
n0tune project detect
n0tune handoff continue --target codex --copy
```

## Workflow B: Cursor To Claude

1. User works in Cursor.
2. Cursor saves project memory and current task notes through MCP.
3. Cursor creates a Handoff Capsule when work pauses.
4. User opens Claude Code in the same folder.
5. Claude detects the same project and retrieves the latest capsule.
6. Claude continues with the same decisions and next steps.

## Workflow C: CLI Fallback

Use this when MCP is unavailable or a tool does not support MCP:

```bash
n0tune project detect
n0tune handoff latest
n0tune handoff continue --target claude --copy
```

Paste the copied continuation prompt into the target tool.

## What Is Working Now

- Same-folder detection maps to the same project row.
- Different folders map to different projects.
- Project memory is isolated by `project_id`.
- Handoff Capsules can be created and continued through API, CLI, and MCP.
- Dashboard shows detected project, project sessions, and handoffs.

## What Is Planned

- automatic transcript capture from each vendor tool
- proactive token danger detection inside each tool
- desktop-local session watcher
- one-click dashboard handoff creation
