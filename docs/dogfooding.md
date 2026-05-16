# Dogfooding

N0Tune now includes a reproducible dogfooding path.

## Run

```powershell
docker compose up --build
.\scripts\seed-dogfooding.ps1
.\scripts\smoke-mvp.ps1
```

The script:

- stores N0Tune project memories
- stores a N0Tune builder style profile
- indexes `docs/context-compiler.md`
- runs a context preview

## What Was Tested

- memory create/search
- style profile update
- document chunking
- injection scoring
- context preview
- token estimate
- token-savings estimate

## What Worked

- N0Tune can store project decisions as memories
- N0Tune can index its own docs
- context preview selects memories and docs
- context trace explains selections and exclusions
- dashboard can inspect the data

## What Failed Or Remains Weak

- token savings are estimates, not model-provider billing data
- embeddings are deterministic local vectors for MVP only
- docs are seeded manually, not watched automatically
- repeated early seed runs can leave duplicate demo rows in an existing local database; the current seed script skips duplicates on later runs

## Token Savings Estimate

The current dogfooding preview reports estimated prompt tokens and estimated tokens saved in the API response. Exact numbers vary as docs and seed data change, so the report is treated as a reproducible smoke signal rather than a benchmark.

## Next Dogfooding Step

Use N0Tune context preview while editing Phase 8 hardening issues, then record selected memories/chunks and token estimates in [token-savings-report.md](token-savings-report.md).
