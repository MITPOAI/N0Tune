"""Shared eval harness.

The eval suite runs against an in-process API. We don't require Docker so the
suite stays fast and CI-friendly. Each eval lives in ``evals/<name>/run.py``
and exports a ``run(client) -> dict`` function returning a JSON-serialisable
report. ``python -m evals`` walks the registry.
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterable
from contextlib import contextmanager
from typing import Any, Callable

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_session
from app.main import app
from app.models.entities import Base


@contextmanager
def fresh_test_client() -> Iterable[TestClient]:
    """Hand out a TestClient backed by an isolated in-memory SQLite."""
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_session():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def time_block(fn: Callable[[], Any]) -> tuple[Any, float]:
    """Run ``fn``, return ``(result, elapsed_seconds)``."""
    start = time.perf_counter()
    result = fn()
    return result, time.perf_counter() - start


def emit_report(name: str, payload: dict[str, Any]) -> str:
    """Pretty-print a JSON report and return its string form."""
    body = json.dumps(payload, indent=2, sort_keys=True, default=str)
    print(f"=== {name} ===")
    print(body)
    print()
    return body
