# Evaluations

> :construction: This directory is a placeholder. The eval harness is planned
> for **v1.0** per [docs/roadmap.md](../docs/roadmap.md). Do not treat the
> structure below as a load-bearing API yet.

## Why this directory exists today

The README and `docs/docs-style-guide.md` cite `evals/` as the source of
truth for benchmark methodology and scripts. Keeping the directory in the
repo prevents broken links and signals that benchmarks are an intentional,
upcoming deliverable rather than an afterthought.

## Planned layout

```
evals/
├── token_savings_eval/        # naive prompt vs. compiled prompt token deltas
├── memory_relevance_eval/     # do the right memories surface for a query?
├── context_compression_eval/  # how compact is the compiled context vs. baseline?
├── prompt_injection_eval/     # are malicious chunks downranked or excluded?
├── semantic_cache_eval/       # cache hits return correct, fresh answers
└── answer_quality_eval/       # human-graded or LLM-judged response quality
```

Each subdirectory will own:

- A small README describing the dataset and metric.
- A scenario YAML/JSON file enumerating inputs.
- A Python entry point: `python -m evals.<name>.run` writing a JSON report.

## Methodology principles

- **Cite numbers, never adjectives.** "Saved ~86 % tokens on the
  two-user personalization scenario" beats "smarter prompts."
- **Public, reproducible datasets only.** No proprietary corpora unless
  the license is documented.
- **Document the baseline.** Every eval needs a clearly defined "without
  N0Tune" comparison.
- **Cap the scope.** First eval landings target single scenarios, not
  industry-wide benchmarks.

## Until then

For an honest snapshot of what the compiler is saving today, see
[docs/token-savings-report.md](../docs/token-savings-report.md). That doc is
hand-curated rather than scripted; the eval harness will replace it.
