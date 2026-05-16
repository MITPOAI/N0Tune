# Docs style guide

Short, opinionated rules for writing docs in this repo. The goal is consistency,
not literary merit. When in doubt, copy the tone of `docs/context-compiler.md`
or `docs/security.md`.

## Voice

- Plain, factual, second person where useful ("You can...", "N0Tune does...").
- Active voice. "The compiler scores chunks." Not "Chunks are scored by the
  compiler."
- No hype. If a feature is "fast," say *how* fast (and against what).
- No corporate filler. Cut "powerful", "robust", "best-in-class".
- Don't shout. Avoid all-caps section headers and excessive **bold**.

## What every doc has

1. A one-line opening that says what the doc is for.
2. An example before the explanation, when there's something to show.
3. A "Limitations" or "What this does not cover" section when the answer is
   non-trivial.
4. Links to the source files referenced (e.g.
   [`apps/api/app/services/context/compiler.py`](../apps/api/app/services/context/compiler.py)).

## Headings

- `#` for the document title. One per file.
- `##` for top-level sections. Sentence case (`## Memory lifecycle`, not
  `## Memory Lifecycle`).
- `###` for sub-sections. Don't go deeper than `###` unless absolutely
  necessary.

## Code blocks

- Always specify the language: ` ```python `, ` ```bash `, ` ```yaml `.
- Prefer copy-pasteable commands. If a value must be filled in, use
  `<angle-brackets>` and add a sentence above.
- For CLI examples in this repo's docs, use **bash** style even when the
  Windows path uses backslashes. Note the equivalent in prose when relevant.

## Links

- Relative links between docs in this repo: `[context-compiler](context-compiler.md)`.
- Link to source files when referencing code, including line numbers when they
  remain stable: `[chat.py:30](../apps/api/app/routes/chat.py)`.
- Don't link to deep blob URLs on github.com — they break across forks.

## Formatting conventions

- `n0tune` (lowercase) for packages, CLI, env vars, Docker images, npm scope.
- `N0Tune` for display name, headings, and prose.
- Environment variables: `N0TUNE_FOO` in code blocks, **never** quoted in
  prose.
- API paths in inline code: `POST /v1/chat`.
- Keep lines under ~100 characters when practical. Hard-wrap is fine.

## Diagrams

- ASCII first, only switch to a real image if ASCII becomes unreadable.
- Store generated images in `img/`. Reference them with relative paths.
- Caption images in italic prose immediately below the image.

## Examples that talk to the API

- Use `app_id=demo` and `user_id=user_1` as the standard example identifiers.
- Use `replace-with-local-development-key` as the placeholder API key — it
  matches the dev `.env.example` value so quickstarts work out of the box.

## What we don't write

- Tutorials longer than ~500 lines. Split them.
- Roadmaps in prose. Use bullet points in [docs/roadmap.md](roadmap.md).
- Marketing copy. The README is the closest doc to marketing we keep, and
  even there we cite numbers.
- Mock features. If something isn't implemented yet, label it explicitly
  ("planned for v0.5") and link the roadmap. Never write docs that imply a
  feature works when it doesn't.
