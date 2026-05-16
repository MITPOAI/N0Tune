"""Embedding service with pluggable backend.

The default ``hash`` backend is deterministic, dependency-free, and fast — ideal
for tests and local dev. Set ``N0TUNE_EMBEDDING_PROVIDER=openai`` (with
``N0TUNE_EMBEDDING_OPENAI_API_KEY``) for production-quality embeddings via an
OpenAI-compatible ``/embeddings`` endpoint, or ``fastembed`` to run a local
sentence-transformers model in-process (requires the optional ``fastembed``
dependency).

All backends return a vector of length :data:`EMBEDDING_DIMENSIONS` so it fits
the schema's ``Vector(384)`` column. Backends with higher native dimensions are
asked to project down (OpenAI via the ``dimensions`` parameter, fastembed via a
small-dim default model). If a backend returns the wrong size, we truncate or
zero-pad as a defensive fallback.
"""

from __future__ import annotations

import logging
from threading import Lock
from typing import Any

import httpx
from n0tune_core.tokens import (
    cosine_similarity,
    estimate_tokens,
    hash_embedding,
    normalize_text,
    stable_hash,
)

from app.config import Settings, get_settings
from app.models.entities import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)

__all__ = [
    "cosine_similarity",
    "embed_text",
    "estimate_tokens",
    "normalize_text",
    "stable_hash",
]

_fastembed_model: Any | None = None
_fastembed_lock = Lock()


def embed_text(text: str) -> list[float]:
    settings = get_settings()
    provider = settings.embedding_provider

    if provider == "openai":
        result = _embed_openai(text, settings)
        if result is not None:
            return _conform_dimensions(result)
        logger.warning("openai embedding backend failed; falling back to hash backend")

    if provider == "fastembed":
        result = _embed_fastembed(text, settings)
        if result is not None:
            return _conform_dimensions(result)
        logger.warning("fastembed embedding backend failed; falling back to hash backend")

    return _embed_hash(text)


def _embed_hash(text: str) -> list[float]:
    return hash_embedding(text, EMBEDDING_DIMENSIONS)


def _embed_openai(text: str, settings: Settings) -> list[float] | None:
    if not settings.embedding_openai_api_key:
        return None
    base_url = settings.embedding_openai_base_url.rstrip("/")
    try:
        response = httpx.post(
            f"{base_url}/embeddings",
            headers={"Authorization": f"Bearer {settings.embedding_openai_api_key}"},
            json={
                "model": settings.embedding_model,
                "input": text,
                "dimensions": EMBEDDING_DIMENSIONS,
            },
            timeout=settings.embedding_timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()
        return [float(value) for value in body["data"][0]["embedding"]]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        logger.warning("openai embedding call failed: %s", exc)
        return None


def _embed_fastembed(text: str, settings: Settings) -> list[float] | None:
    global _fastembed_model
    try:
        if _fastembed_model is None:
            with _fastembed_lock:
                if _fastembed_model is None:
                    from fastembed import TextEmbedding

                    _fastembed_model = TextEmbedding(model_name=settings.fastembed_model)
        vectors = list(_fastembed_model.embed([text]))
        return [float(value) for value in vectors[0]]
    except Exception as exc:
        logger.warning("fastembed embedding call failed: %s", exc)
        return None


def _conform_dimensions(vector: list[float]) -> list[float]:
    if len(vector) == EMBEDDING_DIMENSIONS:
        return vector
    if len(vector) > EMBEDDING_DIMENSIONS:
        return vector[:EMBEDDING_DIMENSIONS]
    return vector + [0.0] * (EMBEDDING_DIMENSIONS - len(vector))
