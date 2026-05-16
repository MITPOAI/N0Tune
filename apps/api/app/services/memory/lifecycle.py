"""Memory lifecycle: states, decay, scope helpers.

The intent here is the smallest useful slice of the design in
``docs/memory-lifecycle.md``. We model the states as strings (not a Python
enum on the column) so backfills are easy, and we apply the decay function
lazily on read instead of via a background job. The simpler shape lets the
context compiler do everything it needs in-process.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from math import exp

from app.models.entities import Memory

UTC = timezone.utc


class MemoryState(str, Enum):
    CANDIDATE = "candidate"
    ACTIVE = "active"
    CONFIRMED = "confirmed"
    DEPRECATED = "deprecated"
    CONFLICTED = "conflicted"
    EXPIRED = "expired"
    DELETED = "deleted"


# States that may appear in the compiled context, in priority order.
RETRIEVABLE_STATES = frozenset(
    {MemoryState.ACTIVE.value, MemoryState.CONFIRMED.value, MemoryState.CANDIDATE.value}
)


def is_retrievable(memory: Memory, now: datetime | None = None) -> bool:
    """A memory is eligible for context inclusion when it isn't deleted, expired, or deprecated."""
    if memory.deleted_at is not None:
        return False
    if memory.state not in RETRIEVABLE_STATES:
        return False
    now = now or datetime.now(UTC)
    if memory.expires_at is not None:
        expires_at = memory.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= now:
            return False
    return True


def decay_factor(memory: Memory, now: datetime | None = None, half_life_days: float = 60.0) -> float:
    """Time-decay multiplier applied to confidence at read time.

    Confirmed and confidence-1.0 memories should age slowly, so we anchor decay
    to either ``last_used_at`` or ``last_confirmed_at``. Memories that have
    never been used or confirmed fall back to ``updated_at``.
    """
    now = now or datetime.now(UTC)
    anchor = memory.last_confirmed_at or memory.last_used_at or memory.updated_at
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    age_days = max(0.0, (now - anchor).total_seconds() / 86_400.0)
    if half_life_days <= 0:
        return 1.0
    return exp(-age_days * (0.6931471805599453 / half_life_days))


def effective_confidence(memory: Memory, now: datetime | None = None) -> float:
    """Confidence after time-decay. ``confirmed`` state pins floor at ``confidence``."""
    base = max(0.0, min(1.0, memory.confidence))
    if memory.state == MemoryState.CONFIRMED.value:
        return base
    return base * decay_factor(memory, now=now)


def mark_used(memory: Memory, now: datetime | None = None) -> None:
    memory.last_used_at = now or datetime.now(UTC)


def confirm(memory: Memory, now: datetime | None = None) -> None:
    """Flip a memory to ``confirmed`` and stamp ``last_confirmed_at``."""
    memory.state = MemoryState.CONFIRMED.value
    memory.last_confirmed_at = now or datetime.now(UTC)


def deprecate(memory: Memory, replaced_by_memory_id: str | None = None) -> None:
    """Mark a memory ``deprecated`` and optionally point at its replacement."""
    memory.state = MemoryState.DEPRECATED.value
    if replaced_by_memory_id:
        memory.replaced_by_memory_id = replaced_by_memory_id
        memory.version = (memory.version or 1) + 1
