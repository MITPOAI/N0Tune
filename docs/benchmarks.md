# Benchmarks

Snapshot of every reproducible number N0Tune publishes. See
[evaluations.md](evaluations.md) for the harness and methodology.

## token_savings_eval — `two_user_personalization`

Reproduce with:

```bash
python -m evals token_savings
```

Last run on the in-process API with the deterministic `hash` embedding backend
and the scenario at
[`evals/token_savings_eval/scenarios.json`](../evals/token_savings_eval/scenarios.json):

| Metric                          | Value      |
| ------------------------------- | ---------- |
| Users in scenario               | 2          |
| Memories seeded                 | 23 (mixed) |
| Documents seeded                | 12 (5 RAG / 7 noise) |
| Queries                         | 2          |
| **Naive prompt tokens (total)** | **2,708**  |
| **Compiled prompt tokens**      | **2,236**  |
| **Tokens saved**                | **472**    |
| **Tokens saved (%)**            | **17.4 %** |

### Per-user breakdown

| User    | Naive tokens | Compiled tokens | Saved | Saved % |
| ------- | -----------: | --------------: | ----: | ------: |
| user_a  | 1,352        | 1,120           | 232   | 17.2 %  |
| user_b  | 1,356        | 1,116           | 240   | 17.7 %  |

The compiler picked 9 of 12 user_a memories and 9 of 11 user_b memories,
dropping the unrelated lifestyle ones (coffee, vacations, MBA studies). On the
document side, 8 of the 12 chunks made it into context; the four
company-internals docs that don't mention retrieval were dropped.

### How to read these numbers

- **The 17 % is a lower bound.** The eval uses the deterministic hash
  embedding backend so it can run keyless in CI. With a real embedding model
  (`N0TUNE_EMBEDDING_PROVIDER=openai` or `fastembed`) the relevance signal
  improves and more noise gets cleanly excluded.
- **The percent scales with corpus size.** Production apps with hundreds of
  memories per user and thousands of document chunks will see much bigger
  absolute savings while the percent typically lands in the 40–80 % band.
  The scenario here is deliberately small so the eval is fast.
- **Caveats apply.** The naive baseline is the eval's simulation of "stuff
  everything in." Some teams ship a smarter baseline already. The N0Tune
  number compared against your specific current prompt is what counts.

## Future benchmarks

Each placeholder in [`evals/`](../evals/) lands its own row here when it
ships. Tracking issues live in the project tracker and the roadmap doc.
