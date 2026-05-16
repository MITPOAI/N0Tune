from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import Memory
from app.schemas.api import DeleteResponse, MemoryCreate, MemoryResponse, MemoryUpdate
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.security.auth import authorize_app, ensure_user
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
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
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
    )
    session.add(memory)
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
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    memory = session.get(Memory, memory_id)
    if memory is None or memory.app_id != payload.app_id or memory.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")

    if payload.text is not None:
        assert_no_secrets(payload.text)
        memory.text = payload.text
        memory.embedding = embed_text(payload.text)
    if payload.type is not None:
        memory.type = payload.type
    if payload.confidence is not None:
        memory.confidence = payload.confidence
    if payload.expires_at is not None:
        memory.expires_at = payload.expires_at
    memory.updated_at = datetime.now(UTC)

    session.commit()
    session.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.delete("/{memory_id}", response_model=DeleteResponse)
async def delete_memory(
    memory_id: str,
    app_id: str = Query(default="demo"),
    hard: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DeleteResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    memory = session.get(Memory, memory_id)
    if memory is None or memory.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found.")

    if hard:
        session.delete(memory)
        session.commit()
        return DeleteResponse(id=memory_id, deleted=True, hard_deleted=True)

    memory.deleted_at = datetime.now(UTC)
    memory.updated_at = datetime.now(UTC)
    session.commit()
    return DeleteResponse(id=memory_id, deleted=True, hard_deleted=False)
