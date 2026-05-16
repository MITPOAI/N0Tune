# Release checklist

The list below is what we run before tagging an N0Tune release. It's
deliberately short so a single maintainer can complete it in an hour.

## Before you start

- [ ] Decide the version. Pre-1.0: minor bumps may include breaking
      changes (call them out in CHANGELOG).
- [ ] Confirm `main` CI is green.
- [ ] No "Unreleased" CHANGELOG entries are missing.

## Tests

- [ ] `pytest apps/api/app/tests` is green.
- [ ] `pytest packages/core/tests` is green.
- [ ] `pytest packages/sdk-py/tests` is green.
- [ ] `pytest integrations/langchain/tests` is green.
- [ ] `pytest integrations/llamaindex/tests` is green.
- [ ] `pytest integrations/markdown-folder/tests` is green.
- [ ] `npm test --workspaces --if-present` is green.
- [ ] `python -m evals token_savings` reproduces the headline (>= 15 %).

## Lint + types

- [ ] `ruff check apps/api packages/core packages/sdk-py integrations` is
      clean.
- [ ] `mypy apps/api/app packages/core/src packages/sdk-py/src integrations/langchain/src integrations/llamaindex/src integrations/markdown-folder/src`
      is clean.
- [ ] `npm --workspace apps/desktop run typecheck` is clean.
- [ ] `npm --workspace packages/cli run typecheck` is clean.
- [ ] `npm --workspace apps/dashboard run typecheck && run lint` are clean.

## Security

- [ ] `gitleaks detect --source . --redact --verbose` finds nothing new.
- [ ] `pip-audit` reports no `HIGH` or `CRITICAL`.
- [ ] `npm audit --omit=dev --audit-level=high` reports no `HIGH` or
      `CRITICAL`.
- [ ] No new dependency without a one-line rationale in the PR
      description.

## Docs

- [ ] [`CHANGELOG.md`](../CHANGELOG.md) has a section for the new
      version, with `Added` / `Changed` / `Fixed` / `Not yet implemented`
      buckets as needed.
- [ ] [`README.md`](../README.md) reflects what actually shipped (the
      honest status board in
      [`docs/product-direction.md`](product-direction.md) is the source of
      truth).
- [ ] [`docs/roadmap.md`](roadmap.md) is up to date.
- [ ] [`docs/dogfooding.md`](dogfooding.md) numbers are not stale.
- [ ] [`docs/providers.md`](providers.md) reflects any new wire shape.

## Versioning bumps

If any of these contain user-facing code, bump them:

- [ ] `apps/api/pyproject.toml`
- [ ] `apps/dashboard/package.json`
- [ ] `apps/desktop/package.json`
- [ ] `packages/cli/package.json`
- [ ] `packages/core/pyproject.toml`
- [ ] `packages/sdk-py/pyproject.toml`
- [ ] `packages/sdk-js/package.json`
- [ ] `integrations/mcp-server/package.json`
- [ ] `integrations/langchain/pyproject.toml`
- [ ] `integrations/llamaindex/pyproject.toml`
- [ ] `integrations/markdown-folder/pyproject.toml`
- [ ] `integrations/vercel-ai-sdk/package.json`

## Tag + release

- [ ] `git tag -a vX.Y.Z -m "Release X.Y.Z"`
- [ ] `git push --tags`
- [ ] Draft GitHub release with the new CHANGELOG section pasted as the
      body.
- [ ] If signed Desktop binaries are part of this release: attach them
      after the build pipeline succeeds. (Not part of v0.x; documented
      here so the checklist is correct when it lands.)

## After the release

- [ ] Update any quickstart snippets referencing the previous version.
- [ ] Sweep open issues for "fixed in vX.Y.Z" and close them with a link.
- [ ] Bump the README badges if the version number is rendered there.
- [ ] Move any unfinished items from "Unreleased / Not yet implemented"
      into a tracking issue.

## Hotfix path

If a critical bug ships in `X.Y.Z`:

1. Branch from the release tag: `git checkout -b hotfix/X.Y.Z+1 vX.Y.Z`.
2. Make the smallest possible change.
3. Run the relevant subset of this checklist (tests + lint + the docs
   that explain the bug).
4. Bump only the patch number.
5. Tag `vX.Y.Z+1`, push, draft release, merge back into `main`.

See [maintainers.md](maintainers.md) for the broader release process.
