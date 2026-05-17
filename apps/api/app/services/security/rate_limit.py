"""Rate-limit middleware backends.

The in-memory backend is the default and works for single-process dev and tests.
The Redis backend uses fixed-window counters via INCR + EXPIRE and is safe across
multiple API replicas. Both implement the same ``hit`` contract so the middleware
can swap them based on ``N0TUNE_RATE_LIMIT_BACKEND``.

Contract
--------
``hit(key, window_seconds, limit)`` returns a :class:`RateLimitDecision`
with everything the middleware needs to set IETF draft-ietf-httpapi-
ratelimit-headers headers on every response, not just 429s:

  * ``allowed``  — whether to admit this request.
  * ``remaining`` — requests still permitted in the current window.
  * ``retry_after`` — seconds until the next slot frees up (0 when allowed).
  * ``reset_at`` — Unix timestamp when the current window ends.

The in-memory backend uses a true sliding-window over monotonic
timestamps (most accurate). The Redis backend is fixed-window (cheaper
across replicas; slightly bursty at window boundaries).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import Request

from app.config import Settings


@dataclass
class RateLimitDecision:
    """Result of one ``hit`` call. Drives both the 429 response and the
    ``X-RateLimit-*`` headers on successful responses."""

    allowed: bool
    remaining: int
    retry_after: int  # 0 when allowed
    reset_at: int  # Unix seconds (UTC) when the current window ends


class RateLimitBackend(Protocol):
    def hit(self, key: str, window_seconds: int, limit: int) -> RateLimitDecision: ...


class InMemoryRateLimitBackend:
    """Sliding-window limiter using monotonic timestamps. Single-process only."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, window_seconds: int, limit: int) -> RateLimitDecision:
        now_mono = time.monotonic()
        now_wall = int(time.time())
        cutoff = now_mono - window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= limit:
                # Window resets when the oldest hit ages out.
                seconds_to_reset = max(1, int(hits[0] + window_seconds - now_mono) + 1)
                return RateLimitDecision(
                    allowed=False,
                    remaining=0,
                    retry_after=seconds_to_reset,
                    reset_at=now_wall + seconds_to_reset,
                )
            hits.append(now_mono)
            remaining = max(0, limit - len(hits))
            # Reset = when the *current* window's oldest hit ages out.
            seconds_to_reset = (
                max(1, int(hits[0] + window_seconds - now_mono) + 1) if hits else window_seconds
            )
            return RateLimitDecision(
                allowed=True,
                remaining=remaining,
                retry_after=0,
                reset_at=now_wall + seconds_to_reset,
            )

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class RedisRateLimitBackend:
    """Fixed-window limiter using Redis INCR + EXPIRE. Multi-replica safe."""

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def hit(self, key: str, window_seconds: int, limit: int) -> RateLimitDecision:
        now_wall = int(time.time())
        window_id = now_wall // window_seconds
        redis_key = f"{key}:{window_id}"
        pipe = self._redis.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, window_seconds)
        results = pipe.execute()
        count = int(results[0])
        # Reset = end of this fixed window.
        reset_at = (window_id + 1) * window_seconds
        seconds_to_reset = max(1, reset_at - now_wall)
        if count > limit:
            raw_ttl = self._redis.ttl(redis_key)
            ttl = int(raw_ttl) if isinstance(raw_ttl, int) and raw_ttl > 0 else seconds_to_reset
            return RateLimitDecision(
                allowed=False,
                remaining=0,
                retry_after=max(1, ttl),
                reset_at=reset_at,
            )
        return RateLimitDecision(
            allowed=True,
            remaining=max(0, limit - count),
            retry_after=0,
            reset_at=reset_at,
        )


def build_backend(settings: Settings) -> RateLimitBackend:
    if settings.rate_limit_backend == "redis":
        import redis

        return RedisRateLimitBackend(redis.Redis.from_url(settings.redis_url))
    return InMemoryRateLimitBackend()


def derive_rate_limit_key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[len("bearer ") :].strip()
        if token:
            return f"key:{token}"
    api_key = request.headers.get("X-N0Tune-API-Key")
    if api_key:
        return f"key:{api_key}"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
        if ip:
            return f"ip:{ip}"
    client_host = request.client.host if request.client else "anon"
    return f"ip:{client_host}"
