# Contributing to N0Tune

N0Tune is early. Contributions should be small, tested, documented, and honest about what is implemented.

## Local setup

```powershell
Copy-Item .env.example .env
py -3.10 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install --upgrade setuptools wheel
.\.venv\Scripts\python -m pip install -e ".\apps\api[dev]"
npm install
```

Run services with Docker:

```powershell
docker compose up --build
```

Run services locally:

```powershell
.\.venv\Scripts\uvicorn app.main:app --app-dir apps/api --reload
npm run dev --workspace apps/dashboard
```

## Branch naming

Use clear branch names:

- `feature/<short-name>`
- `fix/<short-name>`
- `docs/<short-name>`
- `security/<short-name>`
- `chore/<short-name>`

## Filing issues

We accept four kinds of issue, each with its own template under
[`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/):

- **Bug report** — something behaves differently from the docs.
- **Feature request** — a concrete user-facing capability.
- **Documentation issue** — docs are wrong, unclear, or missing.
- **Security report** — please **don't** use this template for actual
  vulnerabilities; follow [SECURITY.md](SECURITY.md) for private
  disclosure.

GitHub Discussions is the right place for open-ended questions and design
debates.

## Pull request rules

- Keep PRs focused.
- Explain the user-facing behavior change.
- Include tests for behavior changes.
- Update docs for setup, API, security, or architecture changes.
- Do not claim incomplete work is done.
- Do not commit real secrets.
- Include screenshots or terminal output when UI or setup changes.

The pull-request template at
[`.github/pull_request_template.md`](.github/pull_request_template.md)
auto-populates a structured checklist. Tick boxes you actually ran;
explicitly mark the rest **N/A** with a one-line reason.

## Required checks

Run these before opening a PR:

```powershell
.\.venv\Scripts\ruff check apps/api
.\.venv\Scripts\mypy apps/api/app
.\.venv\Scripts\pytest apps/api/app/tests
npm run lint
npm run typecheck
npm test
docker compose config
```

Or run:

```powershell
.\scripts\check-phase0.ps1
```

## Security checklist

Before merging, confirm:

- no real `.env` files or secrets are committed
- logs do not include credentials
- every future data query is scoped by `app_id` and user or org
- prompt injection risks are considered for retrieved context
- memory storage rejects likely secrets where applicable
- docs mention security assumptions and limitations

## Docs update requirement

Any phase change must update:

- `README.md`
- `CHANGELOG.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/dogfooding.md`
- relevant API docs

Tone, voice, and formatting conventions live in
[`docs/docs-style-guide.md`](docs/docs-style-guide.md). Maintainer-facing
processes (triage, releases, hotfixes) live in
[`docs/maintainers.md`](docs/maintainers.md). The canonical list of test
commands lives in [`docs/testing.md`](docs/testing.md).

## Adding examples

Examples belong under `examples/<example-name>`. Each example must include:

- purpose
- prerequisites
- setup commands
- how to run
- expected output
- known limitations
- security notes

Do not add examples that require real provider keys unless the README explains exactly how to configure them safely.

## Pre-commit hooks

Install hooks if you use `pre-commit`:

```powershell
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```

The hooks run formatting checks, Python linting, and local secret scanning where available.
