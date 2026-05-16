"""Optional Langfuse observability.

This module is fail-open by design: if the ``langfuse`` package is not
installed, the env keys are not configured, or a trace call raises, N0Tune
keeps serving requests without complaint. Observability must not be allowed
to break the request path.

Enable by setting ``N0TUNE_LANGFUSE_PUBLIC_KEY`` and
``N0TUNE_LANGFUSE_SECRET_KEY`` (host defaults to Langfuse Cloud — override with
``N0TUNE_LANGFUSE_HOST`` for self-hosted Langfuse).
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Any | None = None
_client_initialized = False


def get_client() -> Any | None:
    """Return a singleton Langfuse client, or None if observability is off."""
    global _client, _client_initialized
    if _client_initialized:
        return _client

    settings = get_settings()
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        _client_initialized = True
        return None

    try:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
    except ImportError:
        logger.info("langfuse package not installed; observability is a no-op")
        _client = None
    except Exception as exc:
        logger.warning("langfuse init failed: %s", exc)
        _client = None
    _client_initialized = True
    return _client


def record_observation(name: str, attributes: dict[str, Any]) -> None:
    """Send a single trace event. Never raises."""
    client = get_client()
    if client is None:
        return
    try:
        client.trace(name=name, metadata=attributes)
    except Exception as exc:
        logger.debug("langfuse trace failed: %s", exc)


def reset_for_tests() -> None:
    """Forget any cached client. For tests only."""
    global _client, _client_initialized
    _client = None
    _client_initialized = False
