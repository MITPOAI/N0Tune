from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import get_session
from app.main import app
from app.models.entities import Base


@pytest.fixture()
def engine() -> Generator[Engine]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> Generator[TestClient]:
    def override_session() -> Generator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def fresh_rate_limit_backend() -> Generator[None]:
    """Swap in a brand-new in-memory rate-limit backend for the duration of the test."""
    from app.services.security.rate_limit import InMemoryRateLimitBackend

    previous = getattr(app.state, "rate_limit_backend", None)
    app.state.rate_limit_backend = InMemoryRateLimitBackend()
    try:
        yield
    finally:
        if previous is not None:
            app.state.rate_limit_backend = previous
