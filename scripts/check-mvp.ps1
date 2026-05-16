param(
    [string]$Python = ".\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Python)) {
    throw "Python virtualenv not found at $Python. Run: py -3.10 -m venv .venv; .\.venv\Scripts\python -m pip install -e `".\packages\core[dev]`" -e `".\apps\api[dev]`""
}

& $Python -m ruff check packages/core
& $Python -m ruff check apps/api
& $Python -m mypy packages/core/src
& $Python -m mypy apps/api/app
& $Python -m pytest packages/core/tests
& $Python -m pytest apps/api/app/tests

npm run lint
npm run typecheck
npm test

docker compose config
