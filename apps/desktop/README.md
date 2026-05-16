# N0Tune Desktop

N0Tune Desktop is the planned local app for normal users.

Status: architecture placeholder only. No Desktop app is implemented in Phase A.

## Product Goal

Desktop should let a user create a personal AI powered by their chosen model provider:

- OpenAI
- Anthropic Claude
- Google Gemini
- Qwen
- OpenRouter
- Ollama
- LM Studio
- custom OpenAI-compatible endpoint

N0Tune adds local memory, style, files, semantic cache, and context compilation. The model remains unchanged.

## Recommended Stack

Default:

- Tauri
- React
- TypeScript
- SQLite
- sqlite-vec, LanceDB, or equivalent local vector search

Fallback:

- Electron, only if Tauri blocks MVP speed

## MVP Screens

- Onboarding
- Provider settings
- Chat
- Persona manager
- Style profile
- Memory viewer
- Context preview
- File indexing
- Export/import persona

## First-Run Onboarding

Ask for:

- AI name
- avatar or preset
- provider
- API key or local endpoint
- memory mode
- preferred response style
- optional folders to index

## Local Storage

Desktop should use:

- SQLite for local app data
- local vector store for memories/files
- OS keychain for provider API keys where practical
- local files for persona export/import

Desktop should not require:

- Postgres
- Redis
- Docker
- hosted N0Tune Gateway

## Context Preview

Context preview should show:

- memories used
- file chunks used
- style profile used
- compiled context
- estimated tokens
- excluded risky content
- model/provider selected

This is a core product surface, not a developer-only debug view.

## Security Defaults

- private memory local by default
- file indexing opt-in
- no API key logging
- provider keys deletable
- persona exports exclude memories by default
- MCP disabled unless explicitly configured

## Future Floating Widget

Do not build complex 3D first.

MVP later:

- tray app
- mini chat
- global hotkey if practical
- 2D avatar or `img/logo.png`

Future:

- Live2D
- VRM
- community persona gallery

Only include assets with clear permissive licenses.
