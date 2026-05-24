# Dogfooding Cross-Tool Context

N0Tune must use its own cross-tool context story.

This scenario proves Claude-to-Codex continuation without manual handoff docs.

## Scenario

1. Work in the N0Tune repo with Claude.
2. Store project memory.
3. Create a Handoff Capsule.
4. Open Codex in the same folder.
5. Codex detects the same project.
6. Codex retrieves the latest handoff and project memory.
7. Codex continues from the generated prompt.

## Commands

```bash
docker compose up -d --wait
n0tune project detect
n0tune memory add --project --type decision \
  "N0Tune's core story is cross-tool project continuity."
n0tune session start --tool claude --goal "Implement CT-1 through CT-6 vertical slice."
n0tune handoff create --source claude --target codex \
  "Claude reframed docs and added backend project-context routes. Codex should run tests, finish MCP/CLI checks, and verify the dashboard."
n0tune handoff continue --target codex --copy
```

## MCP Calls

Equivalent MCP call order:

1. `n0tune_project_detect`
2. `n0tune_save_project_memory`
3. `n0tune_create_handoff_capsule`
4. `n0tune_get_latest_handoff`
5. `n0tune_continue_from_handoff`

## Sample Capsule

```json
{
  "source_tool": "claude",
  "target_tool": "codex",
  "goal": "Implement cross-tool project context.",
  "current_state": "Project detection, project memory, sessions, and Handoff Capsules exist in the Gateway.",
  "decisions": ["The project folder is the identity."],
  "tests_run": [
    "pytest apps/api/app/tests/test_project_context.py",
    "npm --workspace packages/cli test",
    "npm --workspace integrations/mcp-server test"
  ],
  "next_steps": [
    "Run dashboard typecheck.",
    "Verify localhost:3000.",
    "Document limitations."
  ]
}
```

## What Worked In This Pass

- Same-folder project detection is covered by API tests.
- Different-folder isolation is covered by API tests.
- Project memory search does not return another project's memory.
- Handoff continuation prompt includes source tool and next steps.
- CLI tests cover `project detect`, `memory add --project`, and
  `handoff continue`.
- MCP exposes project and handoff tools.

## Known Gaps

- This repo cannot capture proprietary Claude/Codex transcript history
  automatically yet.
- Context pressure uses approximate server-side levels for now.
- Dashboard creates handoffs through CLI/MCP/API today; an in-dashboard
  create form is planned.
