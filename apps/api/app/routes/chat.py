from hashlib import sha256

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import Memory
from app.schemas.api import ChatContextResponse, ChatRequest, ChatResponse
from app.services.cache.semantic import lookup_cache, store_cache
from app.services.context.compiler import compile_context, get_style_profile
from app.services.context.embedding import embed_text
from app.services.memory.extraction import extract_memory_candidates
from app.services.observability.langfuse import record_observation
from app.services.providers.router import generate_answer
from app.services.security.auth import authorize_app, ensure_user

router = APIRouter(prefix="/v1", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ChatResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    ensure_user(session, payload.app_id, payload.user_id)

    preview = compile_context(
        session=session,
        request=payload,
        request_id=request.state.request_id,
        cache_hit=False,
        persist_run=False,
    )
    context_hash = sha256(preview.compiled_context.encode("utf-8")).hexdigest()

    if payload.allow_cache:
        cached = lookup_cache(
            session, payload.app_id, payload.user_id, payload.message, context_hash
        )
        if cached is not None:
            cached_preview = compile_context(
                session=session,
                request=payload,
                request_id=request.state.request_id,
                cache_hit=True,
                persist_run=True,
            )
            session.commit()
            cached_response = ChatResponse(
                answer=cached.answer,
                provider=f"{cached.model} cache",
                context=ChatContextResponse(
                    cache_hit=True,
                    memories_used=cached_preview.selected_memories,
                    chunks_used=cached_preview.selected_chunks,
                    style_profile=cached_preview.style_profile,
                    prompt_tokens_estimated=cached_preview.prompt_tokens_estimated,
                    tokens_saved_estimated=cached_preview.tokens_saved_estimated,
                    warnings=cached_preview.warnings,
                ),
            )
            _observe_chat(payload, request.state.request_id, cached_response)
            return cached_response

    answer, provider = await generate_answer(
        payload.model, preview.compiled_context, payload.message
    )
    _extract_and_store_safe_memories(session, payload)
    profile = get_style_profile(session, payload.app_id, payload.user_id)

    store_cache(
        session=session,
        app_id=payload.app_id,
        user_id=payload.user_id,
        message=payload.message,
        answer=answer,
        model=payload.model,
        context_hash=context_hash,
        memory_ids=[memory.id for memory in preview.selected_memories],
        document_ids=list({chunk.document_id for chunk in preview.selected_chunks}),
        style_updated_at=profile.updated_at.isoformat(),
    )

    compile_context(
        session=session,
        request=payload,
        request_id=request.state.request_id,
        cache_hit=False,
        persist_run=True,
    )
    session.commit()

    response = ChatResponse(
        answer=answer,
        provider=provider,
        context=ChatContextResponse(
            cache_hit=False,
            memories_used=preview.selected_memories,
            chunks_used=preview.selected_chunks,
            style_profile=preview.style_profile,
            prompt_tokens_estimated=preview.prompt_tokens_estimated,
            tokens_saved_estimated=preview.tokens_saved_estimated,
            warnings=preview.warnings,
        ),
    )
    _observe_chat(payload, request.state.request_id, response)
    return response


def _observe_chat(payload: ChatRequest, request_id: str, response: ChatResponse) -> None:
    record_observation(
        "chat",
        {
            "app_id": payload.app_id,
            "user_id": payload.user_id,
            "request_id": request_id,
            "model": payload.model,
            "provider": response.provider,
            "cache_hit": response.context.cache_hit,
            "prompt_tokens_estimated": response.context.prompt_tokens_estimated,
            "tokens_saved_estimated": response.context.tokens_saved_estimated,
            "memory_ids": [memory.id for memory in response.context.memories_used],
            "chunk_ids": [chunk.id for chunk in response.context.chunks_used],
            "warnings": response.context.warnings,
        },
    )


def _extract_and_store_safe_memories(session: Session, payload: ChatRequest) -> None:
    extraction = extract_memory_candidates(payload.message)
    for extracted in extraction.memories:
        session.add(
            Memory(
                app_id=payload.app_id,
                user_id=payload.user_id,
                type=extracted.type,
                text=extracted.text,
                confidence=extracted.confidence,
                embedding=embed_text(extracted.text),
            )
        )

    if extraction.style_update:
        profile = get_style_profile(session, payload.app_id, payload.user_id)
        profile.profile_json = {**dict(profile.profile_json), **extraction.style_update}
