# Personas

A persona is the public face of your N0Tune — the name, avatar, style, and
memory mode you want a model to project. Personas are portable
(`.n0tune.json` files); they are **not** the same thing as your private
memory, which never travels by default.

## The four shipped presets

| File                                | Persona                          | Memory mode | Best for                                   |
| ----------------------------------- | -------------------------------- | ----------- | ------------------------------------------ |
| `developer-mentor.n0tune.json`      | A patient senior engineer        | `auto`      | Pairing on architecture or new languages   |
| `study-buddy.n0tune.json`           | Upbeat tutor who quizzes you     | `review`    | Learning a new topic                       |
| `writing-coach.n0tune.json`         | Restrained editor                | `manual`    | Drafts where you control what's remembered |
| `startup-advisor.n0tune.json`       | Pragmatic sparring partner       | `auto`      | Pitching, validating, risk-naming          |

Each is a small JSON file you can read in a text editor. Open any of them
to see the format.

## File format

The schema lives in [`schema.json`](schema.json). Required fields:

```json
{
  "format": "n0tune-persona",
  "version": 1,
  "persona": {
    "name": "Milo",
    "avatar": "img/logo.png",
    "personality": "Friendly, terse, honest.",
    "style": {
      "tone": "casual",
      "depth": "medium",
      "format": "examples + diagrams",
      "avoid": ["long theory"]
    },
    "memoryMode": "auto"
  }
}
```

Optional fields:

- `persona.allowedTools` — array of MCP tool names this persona is allowed
  to expose to remote agents.
- `memories` — exported memory rows. **Omitted by default.** Including
  this is opt-in per export.
- `notes` — free text for humans.

## Memory modes

| Mode      | What                                                                  |
| --------- | --------------------------------------------------------------------- |
| `auto`    | The extractor saves useful memories silently.                         |
| `review`  | The extractor creates `candidate` rows; you approve them later.       |
| `manual`  | Nothing is saved unless you write it explicitly via the API/UI.       |
| `off`     | Each session is independent. The compiler ignores prior memories.     |

`review` is the safe default for personas shared with other humans.

## Importing and exporting

Today's flow uses the CLI:

```bash
# Export the current user's persona (style only, no private memories)
n0tune persona export --out my-persona.n0tune.json

# Validate someone else's persona file
n0tune persona import their-persona.n0tune.json
```

Import currently validates shape and prints a summary; writing into the
Gateway persona endpoint is on the v0.5 roadmap.

## Privacy rules

- Private memories are **never** exported by default. The user must
  explicitly opt-in to include them per export.
- Provider API keys are **never** exported. Persona files don't carry
  secrets.
- Local file contents are **never** exported. Personas refer to file
  paths only, and only when relevant.
- Audit logs and semantic cache rows are **never** exported.
- Imports are previewed before they write anything, so a malicious
  persona file can't silently overwrite your style.

## What this is **not**

- Not a packaging system. We don't sign personas. Treat shared persona
  files like you'd treat shared shell scripts: read before importing.
- Not a model identity. The model doesn't "become" the persona; it
  receives the persona's style in its system prompt. Same model.
  Different prompt.
- Not the place to ship custom tools. Tool wiring belongs in the MCP
  server or the Desktop's allow-list, not in a persona file.
