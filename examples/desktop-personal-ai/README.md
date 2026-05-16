# Desktop Personal AI Demo

Status: future demo plan only. This example is not runnable in Phase A.

The demo should show N0Tune Desktop turning a normal model into a personal AI through context-tuning.

Demo line:

> Meet Milo: a personal AI powered by Gemini/Qwen/GPT, but tuned by your local memory.

## Demo Goal

Show that the same model can answer the same question differently when N0Tune compiles different local context.

N0Tune does not fine-tune the model. It changes the context around the model.

## Scenario

Two users ask:

```text
How should I plan my next product launch?
```

User A has memories and files about:

- indie SaaS
- low budget
- short technical answers
- prefers checklists

User B has memories and files about:

- creator brand
- audience research
- detailed narrative plans
- prefers examples

The model provider is the same. The question is the same. N0Tune compiles different context, so the answer feels personal.

## Expected Flow

1. Launch N0Tune Desktop.
2. Create persona `Milo`.
3. Select provider.
4. Add style profile.
5. Add or import a few memories.
6. Index a small `.md` folder.
7. Ask the launch-planning question.
8. Open context preview.
9. Show memories, files, style, and token estimate.
10. Export the persona as `.n0tune` without private memories.

## Assets

Use `img/logo.png` for the MVP avatar/logo.

Do not add random 3D or avatar assets without clear permissive licenses.

## Implementation Later

This example should become runnable after:

- Phase B Core extraction
- Phase C Desktop Alpha
- Phase D provider router expansion
- Phase G local file memory
