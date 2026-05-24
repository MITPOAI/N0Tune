from datetime import datetime, timezone
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

EMBEDDING_DIMENSIONS = 384
UTC = timezone.utc


class Base(DeclarativeBase):
    pass


def now_utc() -> datetime:
    return datetime.now(UTC)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


class App(Base):
    __tablename__ = "apps"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    api_key_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("app_id", "external_user_id", name="uq_users_app_external"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("usr"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    external_user_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("cnv"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("msg"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("conversations.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(32))
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("mem"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[str] = mapped_column(String(64))
    text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    source_message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    project_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    handoff_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("handoff_capsules.id", ondelete="SET NULL"), nullable=True, index=True
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    state: Mapped[str] = mapped_column(String(32), default="active")
    scope: Mapped[str] = mapped_column(String(32), default="user")
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    replaced_by_memory_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    # NOTE: deliberately no ``onupdate=now_utc`` — retrieval-time stamps
    # (``last_used_at``) should not invalidate the semantic cache. Routes that
    # mutate memory *content* (update_memory, delete_memory, confirm_memory)
    # set ``updated_at`` explicitly so cache freshness still detects edits.
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("app_id", "root_path_hash", name="uq_projects_app_root_hash"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("proj"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    root_path_hash: Mapped[str] = mapped_column(String(64), index=True)
    git_remote_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    fingerprint_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class ProjectTool(Base):
    __tablename__ = "project_tools"
    __table_args__ = (UniqueConstraint("project_id", "tool_name", name="uq_project_tools_project_tool"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("ptl"))
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)


class ProjectSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("ses"))
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    tool_name: Mapped[str] = mapped_column(String(64), index=True)
    tool_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    context_tokens_estimated: Mapped[int] = mapped_column(Integer, default=0)
    context_pressure: Mapped[str] = mapped_column(String(32), default="healthy")
    files_touched_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    commands_run_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    memories_created_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    docs_used_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_steps_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_handoff_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class HandoffCapsule(Base):
    __tablename__ = "handoff_capsules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("hof"))
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    source_tool: Mapped[str] = mapped_column(String(64), index=True)
    target_tool: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_state: Mapped[str] = mapped_column(Text)
    decisions_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    files_changed_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    commands_run_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    errors_seen_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    tests_run_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    next_steps_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    open_questions_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    warnings_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    memory_refs_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    doc_refs_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StyleProfile(Base):
    __tablename__ = "style_profiles"
    __table_args__ = (UniqueConstraint("app_id", "user_id", name="uq_style_profiles_app_user"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("sty"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    profile_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("doc"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(512))
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("chk"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("documents.id", ondelete="CASCADE")
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    injection_risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    injection_risk_reasons_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class SemanticCache(Base):
    __tablename__ = "semantic_cache"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("cac"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    input_hash: Mapped[str] = mapped_column(String(64), index=True)
    input_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    answer: Mapped[str] = mapped_column(Text)
    depends_on_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    model: Mapped[str] = mapped_column(String(255))
    context_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class ContextRun(Base):
    __tablename__ = "context_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("ctx"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    request_id: Mapped[str] = mapped_column(String(128))
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)
    prompt_tokens_estimated: Mapped[int] = mapped_column(Integer)
    prompt_tokens_saved_estimated: Mapped[int] = mapped_column(Integer)
    selected_memories_json: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    selected_chunks_json: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list)
    selected_style_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    context_trace_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class FeedbackEvent(Base):
    __tablename__ = "feedback_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("fbk"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(255))
    message_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rating: Mapped[int] = mapped_column(Integer)
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("key"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    key_hash: Mapped[str] = mapped_column(String(128), unique=True)
    key_prefix: Mapped[str] = mapped_column(String(16))
    role: Mapped[str] = mapped_column(String(32))
    created_by_actor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("aud"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class AlignmentRule(Base):
    """A Context Guard alignment rule.

    A row defines one check the rule engine applies to a proposed agent
    response, plan, or diff. See ``docs/alignment-checker.md`` for the
    schema rationale; in short, each rule has a ``rule_type`` (terminology,
    phase_scope, security, ...), an optional regex ``pattern`` for fast
    text matching, and ``metadata_json`` for type-specific extras
    (allowed_paths for phase_scope, expected benchmark values, etc).
    Rule severity drives whether a hit blocks (``critical``), warns
    strongly (``high``), or is advisory (``medium``/``low``).
    """

    __tablename__ = "alignment_rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("rul"))
    app_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("apps.id", ondelete="CASCADE"), index=True
    )
    rule_type: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(16))  # low | medium | high | critical
    pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )
