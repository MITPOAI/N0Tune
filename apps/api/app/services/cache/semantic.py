from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import Document, Memory, SemanticCache, StyleProfile
from app.services.context.embedding import cosine_similarity, embed_text, stable_hash

UTC = timezone.utc


def lookup_cache(
    session: Session,
    app_id: str,
    user_id: str,
    message: str,
    context_hash: str | None = None,
) -> SemanticCache | None:
    settings = get_settings()
    query_embedding = embed_text(message)
    now = datetime.now(UTC)
    candidates = session.scalars(
        select(SemanticCache).where(
            SemanticCache.app_id == app_id,
            or_(SemanticCache.user_id == user_id, SemanticCache.user_id.is_(None)),
        )
    ).all()

    best: tuple[SemanticCache, float] | None = None
    for candidate in candidates:
        if candidate.expires_at is not None:
            expires_at = candidate.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at <= now:
                continue
        if context_hash is not None and candidate.context_hash != context_hash:
            continue
        if not _dependencies_fresh(session, candidate):
            continue
        score = cosine_similarity(candidate.input_embedding, query_embedding)
        if score >= settings.cache_similarity_threshold and (best is None or score > best[1]):
            best = (candidate, score)

    return best[0] if best else None


def store_cache(
    session: Session,
    app_id: str,
    user_id: str,
    message: str,
    answer: str,
    model: str,
    context_hash: str,
    memory_ids: list[str],
    document_ids: list[str],
    style_updated_at: str | None,
) -> SemanticCache:
    settings = get_settings()
    entry = SemanticCache(
        app_id=app_id,
        user_id=user_id,
        input_hash=stable_hash(message),
        input_embedding=embed_text(message),
        answer=answer,
        model=model,
        context_hash=context_hash,
        depends_on_json={
            "memory_ids": memory_ids,
            "document_ids": document_ids,
            "style_updated_at": style_updated_at,
        },
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.default_cache_ttl_seconds),
    )
    session.add(entry)
    session.flush()
    return entry


def _dependencies_fresh(session: Session, entry: SemanticCache) -> bool:
    updated_at = entry.updated_at
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)

    depends = entry.depends_on_json
    memory_ids = depends.get("memory_ids", [])
    document_ids = depends.get("document_ids", [])

    if isinstance(memory_ids, list):
        for memory_id in memory_ids:
            memory = session.get(Memory, memory_id)
            if memory is None or memory.deleted_at is not None:
                return False
            memory_updated = memory.updated_at
            if memory_updated.tzinfo is None:
                memory_updated = memory_updated.replace(tzinfo=UTC)
            if memory_updated > updated_at:
                return False

    if isinstance(document_ids, list):
        for document_id in document_ids:
            document = session.get(Document, document_id)
            if document is None or document.deleted_at is not None:
                return False
            document_updated = document.updated_at
            if document_updated.tzinfo is None:
                document_updated = document_updated.replace(tzinfo=UTC)
            if document_updated > updated_at:
                return False

    style_updated_at = depends.get("style_updated_at")
    if isinstance(style_updated_at, str):
        profile = session.scalar(
            select(StyleProfile).where(
                StyleProfile.app_id == entry.app_id,
                StyleProfile.user_id == entry.user_id,
            )
        )
        if profile is not None and profile.updated_at.isoformat() != style_updated_at:
            return False

    return True
