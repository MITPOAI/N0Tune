<!--
Thank you for contributing to N0Tune! Please fill in the sections below.
Delete the comment blocks once you're done.
-->

## What changed

<!-- One or two sentences. What does this PR do? -->

## Why

<!-- The problem this solves, the user or maintainer pain it addresses, or
the roadmap entry it advances. Link the issue if one exists. -->

Closes #

## How

<!-- Brief notes on the approach. Bullet points are fine. If the PR is large,
call out the load-bearing files reviewers should look at first. -->

## Tests

<!-- Mark whichever applies. Replace this comment block if you ran additional
suites or had to skip something. -->

- [ ] `pytest apps/api/app/tests` is green
- [ ] `pytest packages/sdk-py/tests` is green (if SDK touched)
- [ ] `pytest integrations/langchain/tests` is green (if integration touched)
- [ ] `pytest integrations/llamaindex/tests` is green (if integration touched)
- [ ] `npm test --workspaces --if-present` is green
- [ ] Playwright e2e is green or N/A (`npm --workspace apps/dashboard run test:e2e`)
- [ ] Manual smoke-tested locally (`scripts/smoke-mvp.ps1` or equivalent curl flow)
- [ ] N/A — no runtime code changed

## Docs

- [ ] [README.md](../README.md) updated if user-visible behavior changed
- [ ] [CHANGELOG.md](../CHANGELOG.md) updated under `Unreleased`
- [ ] [docs/api.md](../docs/api.md) updated if endpoints changed
- [ ] [docs/security.md](../docs/security.md) updated if security behavior changed
- [ ] [docs/context-compiler.md](../docs/context-compiler.md) updated if scoring changed
- [ ] [docs/testing.md](../docs/testing.md) updated if smoke or test commands changed
- [ ] N/A — no docs change required

## Security impact

<!-- Does this change touch auth, secrets, prompt injection, multi-tenant
scoping, or rate limiting? Briefly explain. "No security impact" is a valid
answer; please write it explicitly so reviewers don't have to guess. -->

## Breaking changes

<!-- API surface changes, schema changes, env var renames, removed flags.
If any, describe the migration path. -->

## Screenshots (UI only)

<!-- Before/after screenshots or screen recordings if this touches the
dashboard. -->

## Checklist

- [ ] My commits are signed off / co-authored as expected.
- [ ] Lint (`ruff check apps/api`, `npm run lint`) is clean.
- [ ] Typecheck (`mypy`, `tsc --noEmit`) is clean.
- [ ] Secret scan (`gitleaks detect --source . --redact --verbose`) finds nothing new.
- [ ] I did not skip pre-commit / signing hooks unless explicitly approved.
- [ ] Issue templates and PR template were updated if the contribution workflow changed.
