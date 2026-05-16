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
from collections.abc import Sequence
from hashlib import blake2b, sha256
from math import sqrt
from re import findall
from threading import Lock
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.models.entities import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)

_fastembed_model: Any | None = None
_fastembed_lock = Lock()


def normalize_text(text: str) -> str:
    return " ".join(text.strip().lower().split())


def stable_hash(text: str) -> str:
    return sha256(normalize_text(text).encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, round(len(text) / 4))


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


def cosine_similarity(left: Sequence[float] | None, right: Sequence[float] | None) -> float:
    if left is None or right is None or len(left) == 0 or len(right) == 0:
        return 0.0
    size = min(len(left), len(right))
    return float(sum(left[index] * right[index] for index in range(size)))


def _embed_hash(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSIONS
    tokens = findall(r"[a-zA-Z0-9_]+", normalize_text(text))
    if not tokens:
        return vector

    for token in tokens:
        digest = blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    length = sqrt(sum(value * value for value in vector))
    if length == 0:
        return vector
    return [round(value / length, 6) for value in vector]


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
