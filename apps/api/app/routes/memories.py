from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import Memory
from app.schemas.api import DeleteResponse, MemoryCreate, MemoryResponse, MemoryUpdate
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.memory.consolidation import consolidate as run_consolidate
from app.services.security.audit import record_audit
from app.services.security.auth import authorize_app, ensure_user
from app.services.security.permissions import Permission, require_permission
from app.services.security.secrets import assert_no_secrets

router = APIRouter(prefix="/v1/memories", tags=["memories"])
UTC = timezone.utc


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemoryCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> MemoryResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    ensure_user(session, payload.app_id, payload.user_id)
    assert_no_secrets(payload.text)

    memory = Memory(
        app_id=payload.app_id,
        user_id=payload.user_id,
        type=payload.type,
        text=payload.text,
        confidence=payload.confidence,
        source_message_id=payload.source_message_id,
        embedding=embed_text(payload.text),
        expires_at=payload.expires_at,
        scope=payload.scope,
    )
    session.add(memory)
    session.flush()
    record_audit(
        session,
        app_id=payload.app_id,
        action="memory.create",
        resource_type="memory",
        resource_id=memory.id,
        actor_user_id=payload.user_id,
        actor_role=actor_role,
        metadata={"type": memory.type, "confidence": memory.confidence},
    )
    session.commit()
    session.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.get("", response_model=list[MemoryResponse])
async def list_memories(
    app_id: str = Query(default="demo"),
    user_id: str = Query(...),
    q: str | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[MemoryResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    query = select(Memory).where(Memory.app_id == app_id, Memory.user_id == user_id)
    if not include_deleted:
        query = query.where(Memory.deleted_at.is_(None))

    memories = list(session.scalars(query))
    now = datetime.now(UTC)
    memories = [
        memory
        for memory in memories
        if memory.expires_at is None
        or (
            memory.expires_at.replace(tzinfo=UTC)
            if memory.expires_at.tzinfo is None
            else memory.expires_at
        )
        > now
    ]

    if q:
        query_embedding = embed_text(q)
        scored = sorted(
            ((memory, cosine_similarity(memory.embedding, query_embedding)) for memory in memories),
            key=lambda item: item[1],
            reverse=True,
        )
        return [
            MemoryResponse.model_validate(memory).model_copy(update={"similarity": round(score, 4)})
            for memory, score in scored[:limit]
        ]

    memories = sorted(memories, key=lambda memory: memory.created_at, reverse=True)[:limit]
    return [MemoryResponse.model_validate(memory) for memory in memories]


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    payload: MemoryUpdate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> MemoryResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    memory = session.get(Memory, memory_id)
    if memory is None or memory.app_id != payload.app_id or memory.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")

    changes: dict[str, object] = {}
    if payload.text is not None:
        assert_no_secrets(payload.text)
        memory.text = payload.text
        memory.embedding = embed_text(payload.text)
        changes["text"] = True
    if payload.type is not None:
        memory.type = payload.type
        changes["type"] = payload.type
    if payload.confidence is not None:
        memory.confidence = payload.confidence
        changes["confidence"] = payload.confidence
    if payload.expires_at is not None:
        memory.expires_at = payload.expires_at
        changes["expires_at"] = True
    memory.updated_at = datetime.now(UTC)

    record_audit(
        session,
        app_id=payload.app_id,
        action="memory.update",
        resource_type="memory",
        resource_id=memory.id,
        actor_user_id=memory.user_id,
        actor_role=actor_role,
        metadata={"fields": list(changes.keys())},
    )
    session.commit()
    session.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.post("/{memory_id}/confirm", response_model=MemoryResponse)
async def confirm_memory(
    memory_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> MemoryResponse:
    from app.services.memory.lifecycle import confirm

    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    memory = session.get(Memory, memory_id)
    if memory is None or memory.app_id != app_id or memory.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")
    confirm(memory)
    record_audit(
        session,
        app_id=app_id,
        action="memory.confirm",
        resource_type="memory",
        resource_id=memory.id,
        actor_user_id=memory.user_id,
        actor_role=actor_role,
        metadata={},
    )
    session.commit()
    session.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.get("/export", response_model=list[MemoryResponse])
async def export_memories(
    app_id: str = Query(default="demo"),
    user_id: str = Query(...),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[MemoryResponse]:
    """Return every memory for a user including soft-deleted and deprecated rows."""
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.READ_MEMORY)
    memories = list(
        session.scalars(
            select(Memory).where(Memory.app_id == app_id, Memory.user_id == user_id)
        )
    )
    return [MemoryResponse.model_validate(memory) for memory in memories]


@router.delete("/{memory_id}", response_model=DeleteResponse)
async def delete_memory(
    memory_id: str,
    app_id: str = Query(default="demo"),
    hard: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DeleteResponse:
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.DELETE_MEMORY)
    memory = session.get(Memory, memory_id)
    if memory is None or memory.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")

    record_audit(
        session,
        app_id=app_id,
        action="memory.delete",
        resource_type="memory",
        resource_id=memory_id,
        actor_user_id=memory.user_id,
        actor_role=actor_role,
        metadata={"hard": hard},
    )

    if hard:
        session.delete(memory)
        session.commit()
        return DeleteResponse(id=memory_id, deleted=True, hard_deleted=True)

    memory.deleted_at = datetime.now(UTC)
    memory.updated_at = datetime.now(UTC)
    session.commit()
    return DeleteResponse(id=memory_id, deleted=True, hard_deleted=False)


@router.post("/consolidate")
async def consolidate_memories(
    app_id: str = Query(default="demo"),
    user_id: str = Query(...),
    similarity_threshold: float = Query(default=0.85, ge=0.0, le=1.0),
    dry_run: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    """Collapse clusters of similar memories into a single summary.

    Active memories whose embeddings are above ``similarity_threshold``
    are merged into one summary memory; the originals are marked
    ``deprecated`` and point at the summary via ``replaced_by_memory_id``.
    The compiler's existing lifecycle filter excludes deprecated rows
    automatically, so future chats see only the summary.
    """
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    ensure_user(session, app_id, user_id)

    report = run_consolidate(
        session,
        app_id=app_id,
        user_id=user_id,
        similarity_threshold=similarity_threshold,
        dry_run=dry_run,
    )

    if not dry_run:
        record_audit(
            session,
            app_id=app_id,
            action="memory.consolidate",
            resource_type="memory",
            actor_user_id=user_id,
            actor_role=actor_role,
            metadata={
                "clusters_collapsed": report.clusters_collapsed,
                "new_summary_ids": list(report.new_summary_ids),
                "active_before": report.active_before,
                "active_after": report.active_after,
                "similarity_threshold": similarity_threshold,
            },
        )
    session.commit()
    return report.as_dict()
