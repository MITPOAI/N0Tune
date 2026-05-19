# Persona file format (`.n0tune`) — import flow

> **Schema reference:** [`personas/schema.json`](../personas/schema.json) is
> the source of truth for the file format. This doc covers the **import
> behavior** added in v0.2.

A `.n0tune` file is N0Tune's portable persona container — a JSON file
with a style profile and an optional pack of starter memories. Export
one with `n0tune persona export`. Import it on any machine with
`n0tune persona import <file-or-name>`.

## Anatomy (v1)

The full schema is in [`personas/schema.json`](../personas/schema.json).
At a glance:

```jsonc
{
  "format": "n0tune-persona",
  "version": 1,
  "persona": {
    "name": "Senior staff engineer",
    "personality": "Pragmatic, code-first, terse.",
    "avatar": "img/logo.png",
    "style": {
      "tone": "direct",
      "depth": "medium",
      "format": "code-first",
      "avoid": ["motivational framing", "long theory"]
    },
    "memoryMode": "auto"
  },
  "memories": [                              // ← optional, top-level
    { "type": "preference", "text": "...", "confidence": 0.9 }
  ],
  "notes": "free text for humans"
}
```

Required: `format`, `version`, `persona.name`, `persona.style`,
`persona.memoryMode`. Memories are optional but recommended — see
[`personas/senior-staff-eng.n0tune.json`](../personas/senior-staff-eng.n0tune.json)
for a working example with 8 starter memories.

## What import actually does (v0.2)

Before v0.2, `n0tune persona import` validated the file shape and
printed "OK". Starting with v0.2, import is **applied**:

1. **PATCH `/v1/users/{user_id}/style`** with `persona.style` →
   updates the style profile.
2. **POST `/v1/memories`** for each entry in `memories[]`. Each row is
   scoped to the importing user_id and app_id.
3. **Skip duplicates** by text-equality against existing memories for
   the same user_id (no semantic dedup — that's the consolidator's job).
4. **Print a summary**: style fields applied + count of memories
   created vs skipped.

The Gateway endpoints used are already documented in
[`apps/api/app/routes/style.py`](../apps/api/app/routes/style.py) and
[`apps/api/app/routes/memories.py`](../apps/api/app/routes/memories.py).
No new endpoints were added for v0.2.

## Three ways to point at a file

```bash
# 1. By bare name — resolves against N0TUNE_PERSONAS_URL.
#    Default: https://raw.githubusercontent.com/MITPOAI/n0tune-personas/main/personas/
n0tune persona import senior-staff-eng --user-id $YOU

# 2. Local path
n0tune persona import ./personas/senior-staff-eng.n0tune.json --user-id $YOU

# 3. GitHub shorthand (gh:owner/repo/path)
n0tune persona import gh:MITPOAI/N0Tune/personas/marketing-lead.n0tune.json --user-id $YOU
```

Form 1 is the discoverability path — `n0tune persona import
senior-staff-eng` should "just work" against the community repo. Form 2
is the local-development path. Form 3 is for personas hosted in *any*
GitHub repo (not just the default).

## Verification — try it locally

```bash
# Pick a fresh user_id
export TEST_USER=clean_room_$(date +%s)

# Import a local persona
node packages/cli/bin/n0tune.mjs persona import \
  ./personas/senior-staff-eng.n0tune.json --user-id "$TEST_USER"

# Confirm style applied
curl -s "http://localhost:8000/v1/users/$TEST_USER/style?app_id=demo" | jq .profile_json

# Confirm memories landed
node packages/cli/bin/n0tune.mjs memory list --user-id "$TEST_USER" --limit 10
```

## What persona import is NOT

- **Not a sync.** It writes once. Subsequent edits to the source file
  do not flow through — re-import to refresh.
- **Not a model identity.** The model never "becomes" the persona; it
  receives the persona's style block in its compiled prompt.
- **Not a secret carrier.** Provider keys live in the OS keychain
  (Desktop) or the Gateway `.env`. Never in a persona file.
- **Not a document loader.** Indexed documents are corpus, not persona.
  Use `n0tune files sync` for that.

## What a persona export EXCLUDES

By design, `n0tune persona export` does **not** include:

- User-scoped (private) memories — only style profile travels by default.
- API keys.
- Document chunks.
- Cache entries.
- Audit log rows.

The [Persona privacy alignment rule](../scripts/seed-alignment-rules.py)
fires `aligned: false` if any caller sets
`include_private_memories = True` — that's the Context Guard catching
exporters who try to widen the surface beyond style.
