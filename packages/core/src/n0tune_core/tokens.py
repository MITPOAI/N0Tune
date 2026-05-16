from __future__ import annotations

from collections.abc import Sequence
from hashlib import blake2b, sha256
from math import sqrt
from re import findall


def normalize_text(text: str) -> str:
    return " ".join(text.strip().lower().split())


def stable_hash(text: str) -> str:
    return sha256(normalize_text(text).encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, round(len(text) / 4))


def cosine_similarity(left: Sequence[float] | None, right: Sequence[float] | None) -> float:
    if left is None or right is None or len(left) == 0 or len(right) == 0:
        return 0.0
    size = min(len(left), len(right))
    return float(sum(left[index] * right[index] for index in range(size)))


def hash_embedding(text: str, dimensions: int) -> list[float]:
    """Return a deterministic normalized feature-hash embedding.

    This is intentionally simple. It keeps tests, local demos, and keyless
    Gateway/CLI paths deterministic while provider-specific embedding backends
    remain adapter code outside Core.
    """
    if dimensions <= 0:
        raise ValueError("dimensions must be positive")

    vector = [0.0] * dimensions
    tokens = findall(r"[a-zA-Z0-9_]+", normalize_text(text))
    if not tokens:
        return vector

    for token in tokens:
        digest = blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    length = sqrt(sum(value * value for value in vector))
    if length == 0:
        return vector
    return [round(value / length, 6) for value in vector]
