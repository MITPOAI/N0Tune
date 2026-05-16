# Scripts

This folder contains helper scripts for local development and validation.

- `check-mvp.ps1` runs Python lint, Python typecheck, backend tests, Node lint, Node typecheck, frontend/SDK/MCP tests, and `docker compose config`.
- `check-phase0.ps1` is a compatibility wrapper around `check-mvp.ps1`.
- `smoke-mvp.ps1` checks a running Docker Compose stack end to end: health, memory, style, document chunks, context preview, chat cache, OpenAI-compatible proxy, and dashboard HTTP.
- `seed-dogfooding.ps1` seeds N0Tune memories, style, docs, and a context preview against a running API. It skips duplicate sample memories and documents on repeat runs.
