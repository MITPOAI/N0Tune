# Maintainer guide

This is the small set of operations a maintainer needs to keep N0Tune
healthy. If you're a contributor looking for development setup, read
[CONTRIBUTING.md](../CONTRIBUTING.md) instead.

## Roles

- **Triage** — Read new issues. Label, ask follow-ups, close obvious dupes.
- **Reviewer** — Approve PRs. At least one reviewer outside the author.
- **Release manager** — Cuts versions, updates CHANGELOG, tags releases.
- **Security responder** — Handles private security reports per
  [SECURITY.md](../SECURITY.md).

One person can wear multiple hats. Don't gate small PRs on a quorum.

## Day-to-day

### Triage cadence

- Aim to leave a first response on new issues within **2 working days**.
- Apply one of: `bug`, `enhancement`, `documentation`, `security`,
  `question`, `wontfix`.
- Close issues that can't be reproduced or have no follow-up after
  14 days, with a clear comment.

### PR review checklist

1. CI is green (or the failure is unrelated and noted in-line).
2. Tests cover the new behavior, or a justified exception is documented.
3. `CHANGELOG.md` has an `Unreleased` entry under the right section.
4. Docs (`README.md`, `docs/api.md`, etc.) updated if user-visible behavior
   changed.
5. No new dependencies without a one-line rationale in the PR description.
6. No real secrets in fixtures (run `gitleaks detect --source . --redact`
   if anything smells off).

For the full reviewer-side workflow, follow the boxes in
[`.github/pull_request_template.md`](../.github/pull_request_template.md).

### Merge style

- Default to **squash merge**. The PR title becomes the squash commit
  subject, so keep titles imperative and under 70 characters.
- Preserve the PR's `Co-Authored-By` lines in the squash body.
- Use **merge commits** only when a branch's history is itself
  load-bearing (rare).

## Releases

### Versioning

N0Tune follows [SemVer](https://semver.org/) **pre-1.0 semantics**:

- `0.MINOR.PATCH` — minor bumps may contain breaking API changes while we
  are < 1.0, but the CHANGELOG must call them out as breaking.
- Once we cut **1.0**, minor bumps no longer break the API.

### Cutting a release

1. Confirm `main` CI is green.
2. Update [CHANGELOG.md](../CHANGELOG.md): move `Unreleased` entries
   under a new `## X.Y.Z - YYYY-MM-DD` heading. Keep an empty
   `Unreleased` heading on top.
3. Bump version in:
   - `apps/api/pyproject.toml`
   - `apps/dashboard/package.json`
   - `packages/sdk-py/pyproject.toml`
   - `packages/sdk-js/package.json`
   - `integrations/mcp-server/package.json`
   - `integrations/langchain/pyproject.toml`
   - `integrations/llamaindex/pyproject.toml`
   - `integrations/vercel-ai-sdk/package.json`
4. Commit: `Release X.Y.Z`.
5. Tag: `git tag -a vX.Y.Z -m "Release X.Y.Z" && git push --tags`.
6. Draft GitHub release with the CHANGELOG section pasted as the body.

### Hotfix

If a critical bug ships in `X.Y.Z`:

1. Branch from the release tag: `git checkout -b hotfix/X.Y.Z+1 vX.Y.Z`.
2. Cherry-pick or write the smallest fix.
3. Update CHANGELOG with a new `## X.Y.Z+1 - YYYY-MM-DD` block.
4. Tag, push, draft the release. Then merge `hotfix/X.Y.Z+1` back into
   `main`.

## Dependencies and security

### Dependency hygiene

Run roughly monthly, or whenever Dependabot opens a batch:

```bash
python -m pip install pip-audit && pip-audit
npm audit --omit=dev --audit-level=high
```

Treat **high** or **critical** advisories as a release blocker.

### Secret scanning

CI runs [Gitleaks](https://github.com/gitleaks/gitleaks) **CLI** via
[`.github/workflows/security.yml`](../.github/workflows/security.yml) on
every push and PR. We deliberately do not use `gitleaks/gitleaks-action`
because it requires a paid `GITLEAKS_LICENSE` secret on organization
repositories and breaks CI for forks. See
[docs/testing.md](testing.md#secret-scanning) for the local command.

If a maintainer ever pushes a real secret:

1. Rotate the credential immediately, even if you "force-push" the file
   away. Git history and forks may already have it.
2. Open a private security issue per [SECURITY.md](../SECURITY.md).
3. Run `git filter-repo` (or BFG) to scrub, then force-push only after
   coordination with other maintainers.

## When in doubt

- Default to writing things down. A short docs PR is almost always better
  than a long Slack message.
- Default to making contributors successful. Replying "this is the wrong
  shape" without saying what the right shape is creates dead branches.
- Default to small. A 200-line PR merged today beats an 800-line PR that
  needs three rounds of review.
