# CLI Project Workflow

The CLI is the fallback when MCP is unavailable.

Run commands from inside the project folder unless you pass `--cwd`.

## Project

```bash
n0tune project detect
n0tune project init
n0tune project status
```

`project init` writes `.n0tune/project.json`, creates
`.n0tune/project.example.json`, and makes sure local project state is ignored
by Git by default.

## Sessions

```bash
n0tune session start --tool claude --goal "Fix dashboard handoff page"
n0tune session list
n0tune session summarize --session-id ses_... "Implemented API routes and tests."
```

Session rows track tool name, goal, model, context pressure, files touched,
commands run, summaries, and next steps.

## Handoffs

```bash
n0tune handoff create --source claude --target codex \
  "Claude finished backend routes. Codex should run tests and update docs."

n0tune handoff latest
n0tune handoff continue --target codex --copy
```

`--copy` tries `clip.exe` on Windows, `pbcopy` on macOS, then `wl-copy` or
`xclip` on Linux. The prompt is always printed to stdout.

## Project Memory

```bash
n0tune memory add --project --type decision "Desktop mode uses Tauri and SQLite."
n0tune memory search --project "SQLite"
```

Project memory is saved through `/v1/projects/{project_id}/memories` and is
isolated from other projects.

## Project Context Preview

```bash
n0tune context preview --project "what should the next AI tool do?"
```

This calls `/v1/projects/{project_id}/context` and returns relevant memories,
project-scoped docs, current tasks, and recent handoffs. Use `n0tune compile`
for the older user-context compiler output.

## Environment

```bash
N0TUNE_BASE_URL=http://localhost:8000
N0TUNE_API_KEY=replace-with-local-development-key
N0TUNE_APP_ID=demo
N0TUNE_USER_ID=cli
```

No command embeds a real secret.
