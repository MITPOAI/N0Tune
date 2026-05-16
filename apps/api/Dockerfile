FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system n0tune && adduser --system --ingroup n0tune n0tune

COPY pyproject.toml README.md* alembic.ini ./
COPY app ./app
COPY alembic ./alembic

RUN python -m pip install --upgrade pip && python -m pip install .

USER n0tune

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
