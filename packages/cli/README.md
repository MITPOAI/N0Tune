# N0Tune CLI

The `n0tune` CLI is planned. It is not implemented in Phase A.

The CLI is a support tool for developers, power users, demos, diagnostics, import/export, and local setup. It is not the main product surface.

## Planned Commands

```text
n0tune doctor
n0tune init
n0tune demo
n0tune memory list
n0tune memory add
n0tune memory delete
n0tune memory export
n0tune persona export
n0tune persona import
n0tune files sync
n0tune mcp install
n0tune gateway start
n0tune desktop start
```

## Command Roles

`n0tune doctor`

- check Desktop service
- check local DB
- check provider config
- check MCP status
- check Gateway status
- show memory count
- show indexed file count

`n0tune init`

- create local config
- choose personal or Gateway mode

`n0tune demo`

- run two-user personalization demo
- show the same model and question with different memory/style/file context

`n0tune memory`

- list memories
- add memory
- delete memory
- export memory

`n0tune persona`

- export `.n0tune` persona files
- import `.n0tune` persona files
- exclude private memory by default

`n0tune files sync`

- sync selected folders
- start with `.md` and `.txt`

`n0tune mcp install`

- print or write MCP config instructions
- never silently modify user files without confirmation

`n0tune gateway start`

- start server mode if supported in the local checkout

`n0tune desktop start`

- start the local desktop helper if needed

## Implementation Direction

Core started as a Python package because Gateway is Python and can reuse it immediately.

The first CLI implementation should prefer the language that avoids duplicating behavior:

- Python is practical for `doctor`, `demo`, Gateway checks, memory import/export, and Core-powered demos.
- TypeScript can still be used later if Desktop needs a JS-facing wrapper.

The CLI should share behavior with Core where practical instead of reimplementing context compilation.

## Safety Rules

- do not print API keys
- do not upload private memory by default
- make destructive memory operations explicit
- dry-run config writes when possible
- explain local vs Gateway mode clearly
