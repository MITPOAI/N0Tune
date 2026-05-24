from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import (
    Document,
    DocumentChunk,
    HandoffCapsule,
    Memory,
    Project,
    ProjectSession,
    now_utc,
)
from app.schemas.api import (
    ChunkResponse,
    DeleteResponse,
    DocumentResponse,
    HandoffCapsuleCreate,
    HandoffCapsuleResponse,
    HandoffContinueRequest,
    HandoffContinueResponse,
    MemoryResponse,
    ProjectContextResponse,
    ProjectDetectRequest,
    ProjectDetectResponse,
    ProjectMemoryCreate,
    ProjectResponse,
    ProjectSessionCreate,
    ProjectSessionResponse,
    ProjectSessionUpdate,
)
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.memory.lifecycle import is_retrievable
from app.services.project_context import (
    context_pressure_for,
    detect_project_from_cwd,
    get_or_create_project,
)
from app.services.security.audit import record_audit
from app.services.security.auth import authorize_app, ensure_user
from app.services.security.permissions import Permission, require_permission
from app.services.security.secrets import assert_no_secrets

router = APIRouter(prefix="/v1", tags=["project-context"])
UTC = timezone.utc


@router.post("/projects/detect", response_model=ProjectDetectResponse)
async def detect_project(
    payload: ProjectDetectRequest,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProjectDetectResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    try:
        detection = detect_project_from_cwd(payload.cwd)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    project, created = get_or_create_project(
        session,
        app_id=payload.app_id,
        detection=detection,
        tool_name=payload.tool_name,
    )
    session.commit()
    session.refresh(project)
    return ProjectDetectResponse(
        project_id=project.id,
        project_name=project.name,
        detected_root=str(detection.root),
        status="created" if created else "existing",
        config_path=str(detection.config_path) if detection.config_path else None,
        fingerprint=detection.fingerprint,
        project=ProjectResponse.model_validate(project),
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProjectResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    return ProjectResponse.model_validate(_project_or_404(session, app_id=app_id, project_id=project_id))


@router.get("/projects/{project_id}/context", response_model=ProjectContextResponse)
async def get_project_context(
    project_id: str,
    app_id: str = Query(default="demo"),
    query: str | None = Query(default=None),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProjectContextResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    project = _project_or_404(session, app_id=app_id, project_id=project_id)
    memories = _project_memories(session, app_id=app_id, project_id=project_id, q=query, limit=12)
    tasks = [
        memory
        for memory in _project_memories(session, app_id=app_id, project_id=project_id, q=None, limit=50)
        if memory.type in {"task", "goal"}
    ][:8]
    handoffs = _handoffs(session, app_id=app_id, project_id=project_id, limit=5)
    docs = _project_docs(session, app_id=app_id, project_id=project_id, q=query, limit=8)
    return ProjectContextResponse(
        project=ProjectResponse.model_validate(project),
        relevant_memories=memories,
        docs=docs,
        handoffs=handoffs,
        current_tasks=tasks,
    )


@router.post(
    "/projects/{project_id}/memories",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_memory(
    project_id: str,
    payload: ProjectMemoryCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> MemoryResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    _project_or_404(session, app_id=payload.app_id, project_id=project_id)
    ensure_user(session, payload.app_id, payload.user_id)
    assert_no_secrets(payload.text)
    memory = Memory(
        app_id=payload.app_id,
        user_id=payload.user_id,
        project_id=project_id,
        session_id=payload.session_id,
        handoff_id=payload.handoff_id,
        type=payload.type,
        text=payload.text,
        confidence=payload.confidence,
        scope="project",
        embedding=embed_text(payload.text),
    )
    session.add(memory)
    session.flush()
    record_audit(
        session,
        app_id=payload.app_id,
        action="project_memory.create",
        resource_type="memory",
        resource_id=memory.id,
        actor_user_id=payload.user_id,
        actor_role=actor_role,
        metadata={"project_id": project_id, "type": memory.type},
    )
    session.commit()
    session.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.get("/projects/{project_id}/memories", response_model=list[MemoryResponse])
async def list_project_memories(
    project_id: str,
    app_id: str = Query(default="demo"),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[MemoryResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    _project_or_404(session, app_id=app_id, project_id=project_id)
    return _project_memories(session, app_id=app_id, project_id=project_id, q=q, limit=limit)


@router.post(
    "/projects/{project_id}/sessions",
    response_model=ProjectSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_session(
    project_id: str,
    payload: ProjectSessionCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProjectSessionResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    _project_or_404(session, app_id=payload.app_id, project_id=project_id)
    pressure = payload.context_pressure or context_pressure_for(payload.context_tokens_estimated)
    row = ProjectSession(
        project_id=project_id,
        tool_name=payload.tool_name.strip().lower() or "unknown",
        tool_session_id=payload.tool_session_id,
        title=payload.title or f"{payload.tool_name.title()} session",
        goal=payload.goal,
        status=payload.status,
        model=payload.model,
        context_tokens_estimated=payload.context_tokens_estimated,
        context_pressure=pressure,
        files_touched_json=payload.files_touched,
        commands_run_json=payload.commands_run,
        memories_created_json=payload.memories_created,
        docs_used_json=payload.docs_used,
        summary=payload.summary,
        next_steps_json=payload.next_steps,
    )
    session.add(row)
    session.flush()
    record_audit(
        session,
        app_id=payload.app_id,
        action="project_session.create",
        resource_type="session",
        resource_id=row.id,
        actor_role=actor_role,
        metadata={"project_id": project_id, "tool_name": row.tool_name},
    )
    session.commit()
    session.refresh(row)
    return ProjectSessionResponse.model_validate(row)


@router.get("/projects/{project_id}/sessions", response_model=list[ProjectSessionResponse])
async def list_project_sessions(
    project_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[ProjectSessionResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    _project_or_404(session, app_id=app_id, project_id=project_id)
    rows = session.scalars(
        select(ProjectSession)
        .where(ProjectSession.project_id == project_id)
        .order_by(ProjectSession.updated_at.desc())
    )
    return [ProjectSessionResponse.model_validate(row) for row in rows]


@router.patch("/sessions/{session_id}", response_model=ProjectSessionResponse)
async def update_project_session(
    session_id: str,
    payload: ProjectSessionUpdate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProjectSessionResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    row = session.get(ProjectSession, session_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _project_or_404(session, app_id=payload.app_id, project_id=row.project_id)
    if payload.status is not None:
        row.status = payload.status
    if payload.context_tokens_estimated is not None:
        row.context_tokens_estimated = payload.context_tokens_estimated
        row.context_pressure = payload.context_pressure or context_pressure_for(payload.context_tokens_estimated)
    elif payload.context_pressure is not None:
        row.context_pressure = payload.context_pressure
    if payload.files_touched is not None:
        row.files_touched_json = payload.files_touched
    if payload.commands_run is not None:
        row.commands_run_json = payload.commands_run
    if payload.memories_created is not None:
        row.memories_created_json = payload.memories_created
    if payload.docs_used is not None:
        row.docs_used_json = payload.docs_used
    if payload.summary is not None:
        row.summary = payload.summary
    if payload.next_steps is not None:
        row.next_steps_json = payload.next_steps
    if payload.ended_at is not None:
        row.ended_at = payload.ended_at
    row.updated_at = now_utc()
    session.commit()
    session.refresh(row)
    return ProjectSessionResponse.model_validate(row)


@router.post(
    "/projects/{project_id}/handoffs",
    response_model=HandoffCapsuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_handoff_capsule(
    project_id: str,
    payload: HandoffCapsuleCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> HandoffCapsuleResponse:
    actor_role = authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.WRITE_MEMORY)
    _project_or_404(session, app_id=payload.app_id, project_id=project_id)
    row = HandoffCapsule(
        project_id=project_id,
        source_tool=payload.source_tool.strip().lower() or "unknown",
        target_tool=payload.target_tool.strip().lower() if payload.target_tool else None,
        title=payload.title or f"{payload.source_tool.title()} handoff",
        goal=payload.goal,
        current_state=payload.current_state,
        decisions_json=payload.decisions,
        files_changed_json=payload.files_changed,
        commands_run_json=payload.commands_run,
        errors_seen_json=payload.errors_seen,
        tests_run_json=payload.tests_run,
        next_steps_json=payload.next_steps,
        open_questions_json=payload.open_questions,
        warnings_json=payload.warnings,
        memory_refs_json=payload.memory_refs,
        doc_refs_json=payload.doc_refs,
    )
    session.add(row)
    session.flush()
    if payload.session_id:
        project_session = session.get(ProjectSession, payload.session_id)
        if project_session is not None and project_session.project_id == project_id:
            project_session.created_handoff_id = row.id
            project_session.status = "handed_off"
            project_session.updated_at = now_utc()
    record_audit(
        session,
        app_id=payload.app_id,
        action="handoff.create",
        resource_type="handoff",
        resource_id=row.id,
        actor_role=actor_role,
        metadata={"project_id": project_id, "source_tool": row.source_tool},
    )
    session.commit()
    session.refresh(row)
    return HandoffCapsuleResponse.model_validate(row)


@router.get("/projects/{project_id}/handoffs", response_model=list[HandoffCapsuleResponse])
async def list_handoff_capsules(
    project_id: str,
    app_id: str = Query(default="demo"),
    source_tool: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[HandoffCapsuleResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    _project_or_404(session, app_id=app_id, project_id=project_id)
    query = select(HandoffCapsule).where(HandoffCapsule.project_id == project_id)
    if source_tool:
        query = query.where(HandoffCapsule.source_tool == source_tool.lower())
    if not include_archived:
        query = query.where(HandoffCapsule.archived_at.is_(None))
    rows = session.scalars(query.order_by(HandoffCapsule.created_at.desc()).limit(limit))
    return [HandoffCapsuleResponse.model_validate(row) for row in rows]


@router.get("/handoffs/{handoff_id}", response_model=HandoffCapsuleResponse)
async def get_handoff_capsule(
    handoff_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> HandoffCapsuleResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    return HandoffCapsuleResponse.model_validate(
        _handoff_or_404(session, app_id=app_id, handoff_id=handoff_id)
    )


@router.post("/handoffs/{handoff_id}/continue-prompt", response_model=HandoffContinueResponse)
async def continue_from_handoff(
    handoff_id: str,
    payload: HandoffContinueRequest,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> HandoffContinueResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    handoff = _handoff_or_404(session, app_id=payload.app_id, handoff_id=handoff_id)
    target = payload.target_tool or handoff.target_tool
    return HandoffContinueResponse(
        handoff_id=handoff.id,
        project_id=handoff.project_id,
        target_tool=target,
        continuation_prompt=_continuation_prompt(handoff, target_tool=target),
    )


@router.delete("/handoffs/{handoff_id}", response_model=DeleteResponse)
async def delete_handoff_capsule(
    handoff_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DeleteResponse:
    actor_role = authorize_app(session, app_id, x_n0tune_api_key, authorization)
    if actor_role is not None:
        require_permission(actor_role, Permission.DELETE_MEMORY)
    handoff = _handoff_or_404(session, app_id=app_id, handoff_id=handoff_id)
    handoff.archived_at = datetime.now(UTC)
    session.commit()
    return DeleteResponse(id=handoff_id, deleted=True, hard_deleted=False)


def _project_or_404(session: Session, *, app_id: str, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None or project.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def _handoff_or_404(session: Session, *, app_id: str, handoff_id: str) -> HandoffCapsule:
    handoff = session.get(HandoffCapsule, handoff_id)
    if handoff is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handoff not found.")
    _project_or_404(session, app_id=app_id, project_id=handoff.project_id)
    return handoff


def _project_memories(
    session: Session,
    *,
    app_id: str,
    project_id: str,
    q: str | None,
    limit: int,
) -> list[MemoryResponse]:
    now = datetime.now(UTC)
    rows = [
        memory
        for memory in session.scalars(
            select(Memory).where(
                Memory.app_id == app_id,
                Memory.project_id == project_id,
                Memory.deleted_at.is_(None),
            )
        )
        if is_retrievable(memory, now=now)
    ]
    if q:
        query_embedding = embed_text(q)
        scored = sorted(
            ((memory, cosine_similarity(memory.embedding, query_embedding)) for memory in rows),
            key=lambda item: item[1],
            reverse=True,
        )[:limit]
        return [
            MemoryResponse.model_validate(memory).model_copy(update={"similarity": round(score, 4)})
            for memory, score in scored
        ]
    rows = sorted(rows, key=lambda memory: memory.created_at, reverse=True)[:limit]
    return [MemoryResponse.model_validate(memory) for memory in rows]


def _project_docs(
    session: Session,
    *,
    app_id: str,
    project_id: str,
    q: str | None,
    limit: int,
) -> list[DocumentResponse]:
    documents = [
        document
        for document in session.scalars(
            select(Document)
            .where(Document.app_id == app_id, Document.deleted_at.is_(None))
            .order_by(Document.created_at.desc())
        )
        if (document.metadata_json or {}).get("project_id") == project_id
    ][:limit]
    query_embedding = embed_text(q) if q else None
    responses: list[DocumentResponse] = []
    for document in documents:
        chunks = list(
            session.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.app_id == app_id, DocumentChunk.document_id == document.id)
                .order_by(DocumentChunk.chunk_index)
            )
        )
        chunk_responses = [ChunkResponse.model_validate(chunk) for chunk in chunks]
        if query_embedding:
            chunk_responses = sorted(
                [
                    response.model_copy(
                        update={
                            "similarity": round(
                                cosine_similarity(chunks[index].embedding, query_embedding),
                                4,
                            )
                        }
                    )
                    for index, response in enumerate(chunk_responses)
                ],
                key=lambda item: item.similarity or 0,
                reverse=True,
            )
        response = DocumentResponse.model_validate(document)
        response.chunks = chunk_responses
        responses.append(response)
    return responses


def _handoffs(
    session: Session,
    *,
    app_id: str,
    project_id: str,
    limit: int,
) -> list[HandoffCapsuleResponse]:
    _project_or_404(session, app_id=app_id, project_id=project_id)
    rows = session.scalars(
        select(HandoffCapsule)
        .where(HandoffCapsule.project_id == project_id, HandoffCapsule.archived_at.is_(None))
        .order_by(HandoffCapsule.created_at.desc())
        .limit(limit)
    )
    return [HandoffCapsuleResponse.model_validate(row) for row in rows]


def _continuation_prompt(handoff: HandoffCapsule, *, target_tool: str | None) -> str:
    target = target_tool or "the next AI tool"
    sections = [
        "# Continue This N0Tune Project",
        f"You are continuing work in project `{handoff.project_id}` using {target}.",
        "",
        f"Source tool: {handoff.source_tool}",
        f"Handoff title: {handoff.title}",
    ]
    if handoff.goal:
        sections.extend(["", "## Goal", handoff.goal])
    sections.extend(["", "## Current State", handoff.current_state])
    sections.extend(_list_section("Decisions", handoff.decisions_json))
    sections.extend(_list_section("Files Changed", handoff.files_changed_json))
    sections.extend(_list_section("Commands Run", handoff.commands_run_json))
    sections.extend(_list_section("Errors Seen", handoff.errors_seen_json))
    sections.extend(_list_section("Tests Run", handoff.tests_run_json))
    sections.extend(_list_section("Next Steps", handoff.next_steps_json))
    sections.extend(_list_section("Open Questions", handoff.open_questions_json))
    sections.extend(_list_section("Warnings", handoff.warnings_json))
    sections.extend(
        [
            "",
            "Start by detecting this project with N0Tune, retrieving project memory, then continue the next step.",
        ]
    )
    return "\n".join(sections)


def _list_section(title: str, items: list[str]) -> list[str]:
    if not items:
        return []
    return ["", f"## {title}", *[f"- {item}" for item in items]]
