"""Unit tests for the compile-time helpers that aren't exercised by
the higher-level API tests.

The integration tests in ``test_api_mvp.py`` cover ``compile_context``
end-to-end, but the internal MMR diversity pass and the public
``_diversify_memories`` helper have edge cases (exact duplicates,
score-zero filtering, embedding-missing entries) that need their own
tests so a threshold change can't silently break retrieval.
"""

from __future__ import annotations

from app.models.entities import Memory
from app.services.context.compiler import (
    MMR_SIMILARITY_THRESHOLD,
    _diversify_memories,
)


def _make_memory(mid: str, text: str, embedding: list[float]) -> Memory:
    """Builds a Memory row with all the not-null defaults the compiler
    reads. Each test below picks an embedding that produces a specific
    cosine relationship with the others to drive the MMR decision."""
    return Memory(
        id=mid,
        app_id="demo",
        user_id="u",
        type="preference",
        text=text,
        confidence=0.9,
        embedding=embedding,
        state="active",
        scope="user",
        version=1,
    )


def test_diversify_keeps_distinct_memories() -> None:
    a = _make_memory("a", "python preference", [1.0, 0.0, 0.0])
    b = _make_memory("b", "macos work", [0.0, 1.0, 0.0])
    c = _make_memory("c", "tauri builds", [0.0, 0.0, 1.0])

    kept, dropped = _diversify_memories([(a, 0.9), (b, 0.8), (c, 0.7)])

    assert [m.id for m, _ in kept] == ["a", "b", "c"]
    assert dropped == []


def test_diversify_drops_near_duplicates() -> None:
    # Two memories whose embeddings are identical → cosine = 1.0,
    # comfortably above the 0.92 threshold. b must be dropped citing a.
    a = _make_memory("a", "first phrasing", [1.0, 0.0])
    b = _make_memory("b", "paraphrase of a", [1.0, 0.0])
    c = _make_memory("c", "different topic", [0.0, 1.0])

    kept, dropped = _diversify_memories([(a, 0.95), (b, 0.93), (c, 0.7)])

    assert [m.id for m, _ in kept] == ["a", "c"]
    assert len(dropped) == 1
    dup_memory, reason = dropped[0]
    assert dup_memory.id == "b"
    assert reason == "near-duplicate of a"


def test_diversify_filters_zero_score() -> None:
    a = _make_memory("a", "ok", [1.0, 0.0])
    b = _make_memory("b", "noise", [0.0, 1.0])

    kept, dropped = _diversify_memories([(a, 0.5), (b, 0.0)])

    # b's score = 0 → it doesn't survive even before the MMR check.
    assert [m.id for m, _ in kept] == ["a"]
    assert dropped == []


def test_diversify_keeps_when_below_threshold() -> None:
    # Cosine ~= 0.7 between two unit vectors that share one axis. Well
    # under MMR_SIMILARITY_THRESHOLD = 0.92, so both must survive.
    a = _make_memory("a", "first", [1.0, 0.0])
    b = _make_memory("b", "related but not duplicate", [0.7, 0.7])

    kept, _ = _diversify_memories([(a, 0.9), (b, 0.8)])
    assert {m.id for m, _ in kept} == {"a", "b"}


def test_diversify_skips_missing_embedding() -> None:
    a = _make_memory("a", "with embedding", [1.0, 0.0])
    b = _make_memory("b", "no embedding", [])
    b.embedding = None

    kept, dropped = _diversify_memories([(a, 0.9), (b, 0.8)])
    # We never want to silently drop a memory just because its
    # embedding is missing — better to keep it than to over-filter.
    assert {m.id for m, _ in kept} == {"a", "b"}
    assert dropped == []


def test_diversify_threshold_is_inclusive() -> None:
    # Pick a custom threshold and exactly hit it — should drop.
    a = _make_memory("a", "anchor", [1.0, 0.0])
    b = _make_memory("b", "exact match", [1.0, 0.0])
    kept, dropped = _diversify_memories(
        [(a, 0.9), (b, 0.85)],
        threshold=MMR_SIMILARITY_THRESHOLD,
    )
    assert [m.id for m, _ in kept] == ["a"]
    assert len(dropped) == 1


def test_diversify_preserves_score_order_among_kept() -> None:
    a = _make_memory("a", "axis 0", [1.0, 0.0, 0.0])
    b = _make_memory("b", "axis 1", [0.0, 1.0, 0.0])
    c = _make_memory("c", "axis 2", [0.0, 0.0, 1.0])

    # Pass in a deliberately non-monotonic order; the function should
    # keep them in the order it received them so a later sort isn't
    # needed.
    kept, _ = _diversify_memories([(b, 0.5), (a, 0.9), (c, 0.7)])
    assert [m.id for m, _ in kept] == ["b", "a", "c"]
