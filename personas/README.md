# Personas

Personas describe a personal AI's name, avatar, personality, style, allowed tools, and memory mode.

Status: format plan only. No persona runtime is implemented in Phase A.

## Goals

Personas should be portable without leaking private memory by default.

The planned export extension is:

```text
.n0tune
```

## Default Export Contents

By default, persona export should include:

- persona name
- avatar reference
- personality
- style profile
- memory mode
- allowed tools
- provider preference without API keys

By default, persona export should not include:

- private memories
- provider API keys
- local file contents
- absolute private file paths
- audit logs
- semantic cache entries

## Export Modes

| Mode                        | Contents                                         |
| --------------------------- | ------------------------------------------------ |
| Persona only                | Persona config, style, avatar reference          |
| Persona + selected memories | Persona config plus user-selected memory records |
| Full encrypted backup       | Future mode for full local backup                |

## Draft Persona Format

```json
{
  "format": "n0tune.persona",
  "version": 1,
  "persona": {
    "name": "Milo",
    "avatar": {
      "type": "image",
      "ref": "avatar.png"
    },
    "personality": "Practical, warm, and direct.",
    "memoryMode": "auto-review",
    "allowedTools": ["memory", "files", "context_preview"]
  },
  "style": {
    "tone": "casual",
    "depth": "medium",
    "format": "examples + diagrams",
    "avoid": ["long theory"]
  },
  "sharing": {
    "includesPrivateMemories": false,
    "includesProviderSecrets": false
  }
}
```

## Preset Direction

Initial preset folders can include:

- `developer-mentor`
- `study-buddy`
- `writing-coach`
- `startup-advisor`

Each preset should include a README and a persona JSON file once the runtime exists.

## Privacy Rules

- private memories are never exported by default
- API keys are never exported
- local file contents are never exported by default
- selected-memory export must be explicit
- imports should preview what will be added before writing
