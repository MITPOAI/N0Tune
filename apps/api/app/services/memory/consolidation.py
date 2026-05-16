"""Memory consolidation — the continual-learning loop.

When a user accumulates enough memories with overlapping topics, the
Context Compiler starts spending tokens on near-duplicates. Consolidation
collapses a cluster of similar memories into a single denser summary and
marks the originals as ``deprecated`` (pointing at the summary via
``replaced_by_memory_id``). The compiler's existing
``is_retrievable`` filter already excludes ``deprecated`` rows, so future
chats see only the summary.

This is the "train by talking → summarize → keep learning" loop the
product pitch promises.

Today the summary text is the deterministic concatenation of the cluster
members. When a provider is configured, the optional ``summarize`` flag
on the API endpoint can call the upstream model for a richer summary; we
keep that out of this module so the consolidation pass works without an
API key (and stays cheap in CI).

The pass can be triggered three ways:

1. **Explicit** — ``POST /v1/memories/consolidate`` or the
   ``n0tune memory consolidate`` CLI.
2. **Automatic, dynamic** — ``maybe_consolidate`` is called as a
   background task after every successful chat / memory write. It
   short-circuits cheaply when the user hasn't accumulated enough
   similar memories yet, so the trigger only does real work when it's
   actually needed.
3. **Scheduled** — call ``maybe_consolidate`` from any cron / scheduler.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Memory
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.memory.lifecycle import MemoryState

UTC = timezone.utc
log = logging.getLogger(__name__)

# Cosine similarity above this threshold means two memories are about the
# same thing. Tuned to the deterministic hash embedding shipped in this
# repo; production embeddings can run with a lower threshold.
DEFAULT_SIMILARITY = 0.85

# Don't collapse fewer than 2 memories into a "summary" — that's just a copy.
MIN_CLUSTER_SIZE = 2

# Auto-trigger thresholds. The dynamic pass short-circuits below these
# numbers to keep the cost of the every-chat hook close to zero.
AUTO_MIN_ACTIVE_MEMORIES = 12  # don't bother until the user has this many
AUTO_COOLDOWN = timedelta(minutes=15)  # min gap between consolidation passes

# Marker we use to identify our own summaries when computing the cooldown.
SUMMARY_PREFIX = "Consolidated summary of "


@dataclass
class ConsolidationCluster:
    """A set of memory ids the consolidation pass would collapse together."""

    seed_id: str
    member_ids: list[str] = field(default_factory=list)
    summary_text: str = ""

    @property
    def size(self) -> int:
        return len(self.member_ids)


@dataclass
class ConsolidationReport:
    """The outcome of a consolidation pass."""

    user_id: str
    app_id: str
    active_before: int
    active_after: int
    new_summary_ids: list[str] = field(default_factory=list)
    clusters_collapsed: int = 0
    dry_run: bool = False

    def as_dict(self) -> dict[str, object]:
        return {
            "user_id": self.user_id,
            "app_id": self.app_id,
            "active_before": self.active_before,
            "active_after": self.active_after,
            "new_summary_ids": list(self.new_summary_ids),
            "clusters_collapsed": self.clusters_collapsed,
            "dry_run": self.dry_run,
        }


def consolidate(
    session: Session,
    *,
    app_id: str,
    user_id: str,
    similarity_threshold: float = DEFAULT_SIMILARITY,
    dry_run: bool = False,
    summarize: bool = False,
) -> ConsolidationReport:
    """Cluster active memories by similarity and collapse each cluster.

    The ``summarize`` flag is reserved for a future provider-backed
    rewrite of the summary text. For now the summary is the
    deterministic concatenation of the cluster members.
    """
    active_memories = _active_memories(session, app_id=app_id, user_id=user_id)
    report = ConsolidationReport(
        user_id=user_id,
        app_id=app_id,
        active_before=len(active_memories),
        active_after=len(active_memories),
        dry_run=dry_run,
    )

    if len(active_memories) < MIN_CLUSTER_SIZE:
        return report

    clusters = _cluster_by_similarity(active_memories, similarity_threshold)
    for cluster in clusters:
        if cluster.size < MIN_CLUSTER_SIZE:
            continue
        summary_text = _build_summary(active_memories, cluster.member_ids, summarize=summarize)
        cluster.summary_text = summary_text
        if dry_run:
            report.clusters_collapsed += 1
            continue

        summary = _create_summary_memory(
            session=session,
            app_id=app_id,
            user_id=user_id,
            summary_text=summary_text,
        )
        _deprecate_originals(
            session=session,
            cluster_member_ids=cluster.member_ids,
            summary_id=summary.id,
        )
        report.new_summary_ids.append(summary.id)
        report.clusters_collapsed += 1

    if dry_run:
        return report

    session.flush()
    report.active_after = len(_active_memories(session, app_id=app_id, user_id=user_id))
    return report


# ---------------------------------------------------------------------------
# internals
# ---------------------------------------------------------------------------


def _active_memories(session: Session, *, app_id: str, user_id: str) -> list[Memory]:
    statement = (
        select(Memory)
        .where(
            Memory.app_id == app_id,
            Memory.user_id == user_id,
            Memory.deleted_at.is_(None),
            Memory.state.in_(
                [MemoryState.ACTIVE.value, MemoryState.CONFIRMED.value, MemoryState.CANDIDATE.value]
            ),
        )
        .order_by(Memory.created_at)
    )
    return list(session.scalars(statement))


def _cluster_by_similarity(
    memories: list[Memory],
    threshold: float,
) -> list[ConsolidationCluster]:
    """Greedy single-link clustering anchored on the oldest unassigned memory."""
    if not memories:
        return []
    assigned: set[str] = set()
    clusters: list[ConsolidationCluster] = []
    for seed in memories:
        if seed.id in assigned:
            continue
        cluster = ConsolidationCluster(seed_id=seed.id, member_ids=[seed.id])
        assigned.add(seed.id)
        seed_embedding = seed.embedding if seed.embedding is not None else embed_text(seed.text)
        for candidate in memories:
            if candidate.id == seed.id or candidate.id in assigned:
                continue
            candidate_embedding = (
                candidate.embedding
                if candidate.embedding is not None
                else embed_text(candidate.text)
            )
            score = cosine_similarity(seed_embedding, candidate_embedding)
            if score >= threshold:
                cluster.member_ids.append(candidate.id)
                assigned.add(candidate.id)
        clusters.append(cluster)
    return clusters


def _build_summary(
    memories: list[Memory],
    member_ids: Iterable[str],
    *,
    summarize: bool,
) -> str:
    by_id = {memory.id: memory for memory in memories}
    pieces = [by_id[mid].text.strip() for mid in member_ids if mid in by_id]
    if summarize:
        # Hook for a provider-backed summary later. Today we collapse
        # deterministically so the pass runs without an API key.
        pieces = sorted(set(pieces))
    bullet_text = "\n".join(f"- {piece}" for piece in pieces)
    return f"Consolidated summary of {len(pieces)} related memories:\n{bullet_text}"


def _create_summary_memory(
    *,
    session: Session,
    app_id: str,
    user_id: str,
    summary_text: str,
) -> Memory:
    summary = Memory(
        app_id=app_id,
        user_id=user_id,
        type="fact",
        text=summary_text,
        confidence=0.95,
        embedding=embed_text(summary_text),
        state=MemoryState.CONFIRMED.value,
        scope="user",
        last_confirmed_at=datetime.now(UTC),
    )
    session.add(summary)
    session.flush()
    return summary


def _deprecate_originals(
    *,
    session: Session,
    cluster_member_ids: Iterable[str],
    summary_id: str,
) -> None:
    now = datetime.now(UTC)
    for member_id in cluster_member_ids:
        memory = session.get(Memory, member_id)
        if memory is None:
            continue
        memory.state = MemoryState.DEPRECATED.value
        memory.replaced_by_memory_id = summary_id
        memory.updated_at = now


# ---------------------------------------------------------------------------
# auto-trigger
# ---------------------------------------------------------------------------


def should_auto_consolidate(
    session: Session,
    *,
    app_id: str,
    user_id: str,
    now: datetime | None = None,
) -> bool:
    """Cheap precheck — does this user have enough active memories AND is it
    long enough since the last consolidation pass?

    Used by the chat + memory write endpoints to short-circuit the
    background consolidation hook when there's nothing to do, so the
    auto-trigger costs O(1) database queries on every chat (not the full
    pairwise similarity sweep ``consolidate`` does).
    """
    now = now or datetime.now(UTC)

    active_count = session.scalar(
        select(func.count())
        .select_from(Memory)
        .where(
            Memory.app_id == app_id,
            Memory.user_id == user_id,
            Memory.deleted_at.is_(None),
            Memory.state.in_(
                [MemoryState.ACTIVE.value, MemoryState.CONFIRMED.value, MemoryState.CANDIDATE.value]
            ),
        )
    )
    if (active_count or 0) < AUTO_MIN_ACTIVE_MEMORIES:
        return False

    # Find the most recent summary memory for this user. If it's newer
    # than the cooldown, skip.
    last_summary_at = session.scalar(
        select(func.max(Memory.created_at))
        .where(
            Memory.app_id == app_id,
            Memory.user_id == user_id,
            Memory.text.like(f"{SUMMARY_PREFIX}%"),
        )
    )
    if last_summary_at is not None:
        if last_summary_at.tzinfo is None:
            last_summary_at = last_summary_at.replace(tzinfo=UTC)
        if now - last_summary_at < AUTO_COOLDOWN:
            return False

    return True


def maybe_consolidate(
    session_factory,
    *,
    app_id: str,
    user_id: str,
) -> ConsolidationReport | None:
    """Run consolidation in a fresh session if the trigger conditions are met.

    Designed to be called from a FastAPI ``BackgroundTasks`` after the
    response is sent: takes a session factory (not a session) because
    the request-scoped session is closed by then. Returns ``None`` when
    the trigger short-circuited; otherwise the ``ConsolidationReport``.
    """
    try:
        with session_factory() as session:
            if not should_auto_consolidate(session, app_id=app_id, user_id=user_id):
                return None
            report = consolidate(session, app_id=app_id, user_id=user_id)
            if report.clusters_collapsed:
                session.commit()
                log.info(
                    "auto_consolidate user=%s collapsed=%d active_before=%d active_after=%d",
                    user_id,
                    report.clusters_collapsed,
                    report.active_before,
                    report.active_after,
                )
            return report
    except Exception:  # pragma: no cover — auto-trigger must never break a chat
        log.exception("auto_consolidate failed user=%s app=%s", user_id, app_id)
        return None
