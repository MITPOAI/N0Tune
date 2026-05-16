# Self-hosting

The MVP supports local self-hosting with Docker Compose.

## Prerequisites

- Docker Desktop
- Docker Compose

## Setup

```powershell
Copy-Item .env.example .env
docker compose config
docker compose up --build
```

Open:

- API: `http://localhost:8000/health`
- Dashboard: `http://localhost:3000`

## Services

| Service | Purpose | Phase 0 behavior |
| --- | --- | --- |
| Postgres + pgvector | Memory, docs, vectors, cache, context logs | Alembic migrations run on API start |
| Redis | Cache/queue infrastructure | Deep health checks connectivity |
| API | FastAPI gateway | Core MVP endpoints |
| Dashboard | Admin and transparency UI | Core workflow pages |

## Production notes

The MVP is not production-ready. Before production use, add:

- real secrets from a secret manager
- TLS
- mandatory API key auth and key rotation
- rate limits
- request body limits
- database migrations
- backup and restore process
- private networking for Postgres and Redis
- log redaction

## Environment variables

Use `.env.example` as the template. Do not commit `.env`.
