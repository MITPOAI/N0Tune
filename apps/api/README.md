# N0Tune API

FastAPI service for N0Tune.

Implemented MVP:

- health
- Alembic migrations
- memory CRUD
- style profile CRUD
- document chunking
- context preview
- chat with provider abstraction
- semantic cache
- OpenAI-compatible proxy

Run locally:

```powershell
py -3.10 -m venv ..\..\.venv
..\..\.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
..\..\.venv\Scripts\python -m pip install -e "..\..\packages\core[dev]"
..\..\.venv\Scripts\python -m pip install -e ".[dev]"
..\..\.venv\Scripts\alembic upgrade head
..\..\.venv\Scripts\uvicorn app.main:app --reload
```
