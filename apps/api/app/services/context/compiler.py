from datetime import datetime, timezone

from n0tune_core.compiler import (
    DEFAULT_STYLE_PROFILE,
    UNTRUSTED_CONTEXT_WARNING,
    DocumentChunkContext,
    MemoryContext,
    blend_scores,
    build_compiled_context,
    estimate_naive_tokens,
)
from n0tune_core.tokens import estimate_tokens
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import ContextRun, Document, DocumentChunk, Memory, StyleProfile
from app.schemas.api import (
    ChunkResponse,
    ContextPreviewRequest,
    ContextPreviewResponse,
    ContextTrace,
    MemoryResponse,
    TraceItem,
)
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.memory.lifecycle import effective_confidence, is_retrievable, mark_used
from app.services.security.auth import ensure_user

UTC = timezone.utc

# Two memories are "near-duplicates" when their text embeddings are above
# this cosine similarity. The MMR pass drops anything past the first one
# in a near-duplicate cluster — keeping prompt space for diverse signals.
MMR_SIMILARITY_THRESHOLD = 0.92


def _is_active_memory(memory: Memory, now: datetime) -> bool:
    return is_retrievable(memory, now=now)


def _diversify_memories(
    scored: list[tuple[Memory, float]],
    *,
    threshold: float = MMR_SIMILARITY_THRESHOLD,
) -> tuple[list[tuple[Memory, float]], list[tuple[Memory, str]]]:
    """Greedy max-marginal-relevance pass.

    Walks the already-ranked list in score order and drops any memory
    whose embedding is too close to one we've already selected. The
    intent is to stop the compiler from spending its token budget on
    five paraphrases of the same fact — common after consolidation
    misses or repeated user statements.

    Returns ``(kept, dropped)`` so the caller can surface the dropped
    memories in the context trace as ``near-duplicate of <other_id>``.
    """
    kept: list[tuple[Memory, float]] = []
    dropped: list[tuple[Memory, str]] = []
    for memory, score in scored:
        if score <= 0:
            continue
        emb = memory.embedding
        duplicate_of: str | None = None
        for prior, _ in kept:
            if prior.embedding is None or emb is None:
                continue
            if cosine_similarity(prior.embedding, emb) >= threshold:
                duplicate_of = prior.id
                break
        if duplicate_of is not None:
            dropped.append((memory, f"near-duplicate of {duplicate_of}"))
        else:
            kept.append((memory, score))
    return kept, dropped


def get_style_profile(session: Session, app_id: str, user_id: str) -> StyleProfile:
    ensure_user(session, app_id, user_id)
    profile = session.scalar(
        select(StyleProfile).where(StyleProfile.app_id == app_id, StyleProfile.user_id == user_id)
    )
    if profile is not None:
        return profile

    profile = StyleProfile(
        app_id=app_id,
        user_id=user_id,
        profile_json=dict(DEFAULT_STYLE_PROFILE),
    )
    session.add(profile)
    session.flush()
    return profile


def compile_context(
    session: Session,
    request: ContextPreviewRequest,
    request_id: str,
    cache_hit: bool = False,
    persist_run: bool = True,
) -> ContextPreviewResponse:
    ensure_user(session, request.app_id, request.user_id)
    query_embedding = embed_text(request.message)
    now = datetime.now(UTC)
    settings = get_settings()
    lexical_weight = max(0.0, min(1.0, settings.hybrid_lexical_weight))

    shared_scopes = ("global", "app", "org", "team")
    if request.project_id:
        memory_scope_filter = or_(
            Memory.user_id == request.user_id,
            Memory.project_id == request.project_id,
            and_(Memory.project_id.is_(None), Memory.scope.in_(shared_scopes)),
        )
    else:
        memory_scope_filter = or_(
            Memory.user_id == request.user_id,
            and_(Memory.project_id.is_(None), Memory.scope.in_(shared_scopes)),
        )
    memory_candidates = [
        memory
        for memory in session.scalars(
            select(Memory).where(
                Memory.app_id == request.app_id,
                memory_scope_filter,
            )
        )
        if _is_active_memory(memory, now)
    ]
    memory_vector_scores = [
        cosine_similarity(memory.embedding, query_embedding) * max(effective_confidence(memory, now=now), 0.05)
        for memory in memory_candidates
    ]
    memory_scores = blend_scores(
        request.message,
        [memory.text for memory in memory_candidates],
        memory_vector_scores,
        lexical_weight,
    )
    scored_memories = sorted(
        zip(memory_candidates, memory_scores, strict=False),
        key=lambda item: item[1],
        reverse=True,
    )
    # MMR diversity — keep the highest-scoring memory in each near-duplicate
    # cluster so we spend the token budget on diverse signals, not paraphrases.
    scored_memories, dropped_duplicates = _diversify_memories(scored_memories)

    chunk_candidates = session.scalars(
        select(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(DocumentChunk.app_id == request.app_id, Document.deleted_at.is_(None))
    ).all()
    chunk_vector_scores = [
        cosine_similarity(chunk.embedding, query_embedding)
        * max(0.0, 1.0 - chunk.injection_risk_score)
        for chunk in chunk_candidates
    ]
    chunk_scores = blend_scores(
        request.message,
        [chunk.text for chunk in chunk_candidates],
        chunk_vector_scores,
        lexical_weight,
    )
    scored_chunks = sorted(
        zip(chunk_candidates, chunk_scores, strict=False),
        key=lambda item: item[1],
        reverse=True,
    )

    profile = get_style_profile(session, request.app_id, request.user_id)
    selected_memories: list[MemoryResponse] = []
    selected_chunks: list[ChunkResponse] = []
    warnings: list[str] = []
    trace = ContextTrace()
    # Record memories dropped as near-duplicates before the token-budget
    # pass even sees them. Lets the dashboard's trace panel show "X memories
    # collapsed via MMR" without re-running the diversity check.
    for memory, reason in dropped_duplicates:
        trace.excluded.append(TraceItem(type="memory", id=memory.id, reason=reason))

    base_sections = [
        "System: You are a helpful assistant using N0Tune compiled context.",
        f"Safety boundary: {UNTRUSTED_CONTEXT_WARNING}",
        f"Style profile: {profile.profile_json}",
    ]
    token_budget = request.max_context_tokens
    used_tokens = sum(estimate_tokens(section) for section in base_sections)

    for memory, score in scored_memories[:12]:
        if score <= 0:
            continue
        section = f"Memory ({memory.type}, confidence {memory.confidence:.2f}): {memory.text}"
        cost = estimate_tokens(section)
        if used_tokens + cost > token_budget:
            trace.excluded.append(
                TraceItem(type="memory", id=memory.id, reason="token budget would be exceeded")
            )
            continue
        used_tokens += cost
        if persist_run:
            mark_used(memory, now=now)
        selected_memories.append(
            MemoryResponse.model_validate(memory).model_copy(update={"similarity": round(score, 4)})
        )
        trace.why_selected.append(
            TraceItem(type="memory", id=memory.id, reason="high similarity and confidence")
        )

    for chunk, score in scored_chunks[:16]:
        if chunk.injection_risk_score >= 0.7:
            warnings.append(f"Excluded high-risk chunk {chunk.id}.")
            trace.excluded.append(
                TraceItem(type="chunk", id=chunk.id, reason="high prompt-injection risk")
            )
            continue
        if score <= 0:
            continue
        section = f"Document chunk ({chunk.document_id}#{chunk.chunk_index}): {chunk.text}"
        cost = estimate_tokens(section)
        if used_tokens + cost > token_budget:
            trace.excluded.append(
                TraceItem(type="chunk", id=chunk.id, reason="token budget would be exceeded")
            )
            continue
        used_tokens += cost
        selected_chunks.append(
            ChunkResponse.model_validate(chunk).model_copy(update={"similarity": round(score, 4)})
        )
        trace.why_selected.append(
            TraceItem(type="chunk", id=chunk.id, reason="high similarity and acceptable risk")
        )

    compiled_context = build_compiled_context(
        style_profile=profile.profile_json,
        memories=[
            MemoryContext(
                id=memory.id,
                type=memory.type,
                text=memory.text,
                similarity=memory.similarity,
            )
            for memory in selected_memories
        ],
        chunks=[
            DocumentChunkContext(
                id=chunk.id,
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                similarity=chunk.similarity,
                injection_risk_score=chunk.injection_risk_score,
            )
            for chunk in selected_chunks
        ],
        message=request.message,
    )
    prompt_tokens = estimate_tokens(compiled_context)
    naive_tokens = estimate_naive_tokens(
        [memory.text for memory in memory_candidates],
        [chunk.text for chunk in chunk_candidates],
        request.message,
    )
    tokens_saved = max(0, naive_tokens - prompt_tokens)

    response = ContextPreviewResponse(
        compiled_context=compiled_context,
        selected_memories=selected_memories,
        selected_chunks=selected_chunks,
        style_profile=profile.profile_json,
        cache_hit=cache_hit,
        prompt_tokens_estimated=prompt_tokens,
        tokens_saved_estimated=tokens_saved,
        warnings=warnings,
        context_trace=trace,
    )

    if persist_run:
        session.add(
            ContextRun(
                app_id=request.app_id,
                user_id=request.user_id,
                request_id=request_id,
                cache_hit=cache_hit,
                prompt_tokens_estimated=prompt_tokens,
                prompt_tokens_saved_estimated=tokens_saved,
                selected_memories_json=[
                    memory.model_dump(mode="json") for memory in selected_memories
                ],
                selected_chunks_json=[chunk.model_dump(mode="json") for chunk in selected_chunks],
                selected_style_json=dict(profile.profile_json),
                context_trace_json=trace.model_dump(mode="json"),
            )
        )
        session.flush()

    return response
