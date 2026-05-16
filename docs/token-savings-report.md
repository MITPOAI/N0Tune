# Token Savings Report

This report records the MVP dogfooding scenario for N0Tune.

## Scenario

Question:

```text
How does N0Tune compile context for a request?
```

Seed context:

- project memories about N0Tune positioning and license
- style profile for direct implementation-ready docs
- `docs/context-compiler.md` indexed as a document

## How to reproduce

Start N0Tune:

```powershell
docker compose up --build
```

Seed dogfooding data:

```powershell
.\scripts\seed-dogfooding.ps1
.\scripts\smoke-mvp.ps1
```

Preview context:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/v1/context/preview -ContentType "application/json" -Body '{
  "app_id": "demo",
  "user_id": "n0tune_builder",
  "message": "How does N0Tune compile context for a request?",
  "max_context_tokens": 1200
}'
```

## Expected MVP result

The response includes:

- compact `compiled_context`
- selected project memories
- selected documentation chunks
- style profile
- prompt injection boundary
- estimated prompt tokens
- estimated tokens saved
- trace of selected and excluded context

The exact token numbers vary as docs evolve. Treat this report as a reproducible smoke path, not a benchmark.
