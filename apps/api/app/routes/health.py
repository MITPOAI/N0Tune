from typing import Literal

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from redis import Redis
from sqlalchemy import text

from app.config import get_settings
from app.db.session import get_engine

router = APIRouter(tags=["health"])


class DependencyStatus(BaseModel):
    database: Literal["ok", "error", "not_checked"]
    redis: Literal["ok", "error", "not_checked"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["n0tune-api"]
    version: str
    phase: Literal["7"]
    request_id: str
    dependencies: DependencyStatus


@router.get("/health", response_model=HealthResponse)
async def health(request: Request, deep: bool = Query(default=False)) -> HealthResponse:
    """Return service health.

    Shallow health is safe for container liveness. Deep health checks database and Redis.
    """

    dependencies = DependencyStatus(database="not_checked", redis="not_checked")
    if deep:
        dependencies = DependencyStatus(database=_database_status(), redis=_redis_status())

    return HealthResponse(
        status="ok",
        service="n0tune-api",
        version="0.1.0",
        phase="7",
        request_id=request.state.request_id,
        dependencies=dependencies,
    )


def _database_status() -> Literal["ok", "error"]:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


def _redis_status() -> Literal["ok", "error"]:
    try:
        Redis.from_url(get_settings().redis_url, socket_connect_timeout=1, socket_timeout=1).ping()
        return "ok"
    except Exception:
        return "error"
