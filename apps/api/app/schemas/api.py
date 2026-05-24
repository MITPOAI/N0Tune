from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MemoryCreate(ApiModel):
    app_id: str = "demo"
    user_id: str
    type: Literal[
        "preference",
        "goal",
        "project",
        "correction",
        "style",
        "fact",
        "decision",
        "architecture",
        "task",
        "constraint",
        "command",
        "file",
        "handoff",
        "bug",
    ] = "fact"
    text: str = Field(min_length=1, max_length=4000)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    source_message_id: str | None = None
    project_id: str | None = None
    session_id: str | None = None
    handoff_id: str | None = None
    expires_at: datetime | None = None
    scope: Literal["global", "app", "org", "team", "project", "user", "session"] = "user"


class MemoryUpdate(ApiModel):
    app_id: str = "demo"
    text: str | None = Field(default=None, min_length=1, max_length=4000)
    type: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    expires_at: datetime | None = None


class MemoryResponse(ApiModel):
    id: str
    app_id: str
    user_id: str
    type: str
    text: str
    confidence: float
    source_message_id: str | None
    project_id: str | None = None
    session_id: str | None = None
    handoff_id: str | None = None
    expires_at: datetime | None
    state: str = "active"
    scope: str = "user"
    last_used_at: datetime | None = None
    last_confirmed_at: datetime | None = None
    version: int = 1
    replaced_by_memory_id: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    similarity: float | None = None


class StylePatch(ApiModel):
    app_id: str = "demo"
    profile_json: dict[str, Any] = Field(default_factory=dict)


class StyleResponse(ApiModel):
    id: str
    app_id: str
    user_id: str
    profile_json: dict[str, Any]
    updated_at: datetime


class DocumentCreate(ApiModel):
    app_id: str = "demo"
    title: str = Field(min_length=1, max_length=255)
    source: str = Field(default="api", max_length=512)
    content: str = Field(min_length=1, max_length=200_000)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class ChunkResponse(ApiModel):
    id: str
    document_id: str
    chunk_index: int
    text: str
    metadata_json: dict[str, Any]
    injection_risk_score: float
    injection_risk_reasons_json: list[str]
    similarity: float | None = None


class DocumentResponse(ApiModel):
    id: str
    app_id: str
    title: str
    source: str
    metadata_json: dict[str, Any]
    content_hash: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    chunks: list[ChunkResponse] = Field(default_factory=list)


class ContextPreviewRequest(ApiModel):
    app_id: str = "demo"
    user_id: str
    project_id: str | None = None
    message: str = Field(min_length=1, max_length=16_000)
    model: str = "n0tune/dev"
    max_context_tokens: int = Field(default=1200, ge=128, le=16_000)


class TraceItem(ApiModel):
    type: str
    id: str
    reason: str


class ContextTrace(ApiModel):
    why_selected: list[TraceItem] = Field(default_factory=list)
    excluded: list[TraceItem] = Field(default_factory=list)


class ContextPreviewResponse(ApiModel):
    compiled_context: str
    selected_memories: list[MemoryResponse]
    selected_chunks: list[ChunkResponse]
    style_profile: dict[str, Any]
    cache_hit: bool = False
    prompt_tokens_estimated: int
    tokens_saved_estimated: int
    warnings: list[str]
    context_trace: ContextTrace


class ChatRequest(ContextPreviewRequest):
    allow_cache: bool = True


class ChatContextResponse(ApiModel):
    cache_hit: bool
    memories_used: list[MemoryResponse]
    chunks_used: list[ChunkResponse]
    style_profile: dict[str, Any]
    prompt_tokens_estimated: int
    tokens_saved_estimated: int
    warnings: list[str]


class ChatResponse(ApiModel):
    answer: str
    provider: str
    context: ChatContextResponse


class CacheEntryResponse(ApiModel):
    id: str
    app_id: str
    user_id: str | None
    input_hash: str
    answer: str
    model: str
    context_hash: str
    depends_on_json: dict[str, Any]
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class CacheListResponse(ApiModel):
    entries: list[CacheEntryResponse]
    total: int


class ContextRunResponse(ApiModel):
    id: str
    app_id: str
    user_id: str
    request_id: str
    cache_hit: bool
    prompt_tokens_estimated: int
    prompt_tokens_saved_estimated: int
    selected_memories_json: list[dict[str, Any]]
    selected_chunks_json: list[dict[str, Any]]
    selected_style_json: dict[str, Any]
    context_trace_json: dict[str, Any]
    created_at: datetime


class DeleteResponse(ApiModel):
    id: str
    deleted: bool
    hard_deleted: bool = False


class ProjectDetectRequest(ApiModel):
    app_id: str = "demo"
    cwd: str | None = None
    tool_name: str | None = None


class ProjectResponse(ApiModel):
    id: str
    app_id: str
    name: str
    root_path_hash: str
    git_remote_hash: str | None
    fingerprint_json: dict[str, Any]
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ProjectToolResponse(ApiModel):
    id: str
    project_id: str
    tool_name: str
    enabled: bool
    last_seen_at: datetime | None
    metadata_json: dict[str, Any]


class ProjectDetectResponse(ApiModel):
    project_id: str
    project_name: str
    detected_root: str
    status: Literal["created", "existing"]
    config_path: str | None = None
    fingerprint: dict[str, Any]
    project: ProjectResponse


class ProjectMemoryCreate(ApiModel):
    app_id: str = "demo"
    user_id: str = "project"
    type: str = "project"
    text: str = Field(min_length=1, max_length=4000)
    confidence: float = Field(default=0.86, ge=0.0, le=1.0)
    session_id: str | None = None
    handoff_id: str | None = None


class ProjectSessionCreate(ApiModel):
    app_id: str = "demo"
    tool_name: str
    tool_session_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    goal: str | None = None
    status: Literal["active", "paused", "summarized", "handed_off", "archived"] = "active"
    model: str | None = None
    context_tokens_estimated: int = Field(default=0, ge=0)
    context_pressure: Literal["healthy", "watch", "danger", "critical"] | None = None
    files_touched: list[str] = Field(default_factory=list)
    commands_run: list[str] = Field(default_factory=list)
    memories_created: list[str] = Field(default_factory=list)
    docs_used: list[str] = Field(default_factory=list)
    summary: str | None = None
    next_steps: list[str] = Field(default_factory=list)


class ProjectSessionUpdate(ApiModel):
    app_id: str = "demo"
    status: Literal["active", "paused", "summarized", "handed_off", "archived"] | None = None
    context_tokens_estimated: int | None = Field(default=None, ge=0)
    context_pressure: Literal["healthy", "watch", "danger", "critical"] | None = None
    files_touched: list[str] | None = None
    commands_run: list[str] | None = None
    memories_created: list[str] | None = None
    docs_used: list[str] | None = None
    summary: str | None = None
    next_steps: list[str] | None = None
    ended_at: datetime | None = None


class ProjectSessionResponse(ApiModel):
    id: str
    project_id: str
    tool_name: str
    tool_session_id: str | None
    title: str
    goal: str | None
    status: str
    model: str | None
    context_tokens_estimated: int
    context_pressure: str
    files_touched_json: list[str]
    commands_run_json: list[str]
    memories_created_json: list[str]
    docs_used_json: list[str]
    summary: str | None
    next_steps_json: list[str]
    created_handoff_id: str | None
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class HandoffCapsuleCreate(ApiModel):
    app_id: str = "demo"
    source_tool: str
    target_tool: str | None = None
    session_id: str | None = None
    title: str | None = Field(default=None, max_length=255)
    goal: str | None = None
    current_state: str = Field(min_length=1, max_length=20_000)
    decisions: list[str] = Field(default_factory=list)
    files_changed: list[str] = Field(default_factory=list)
    commands_run: list[str] = Field(default_factory=list)
    errors_seen: list[str] = Field(default_factory=list)
    tests_run: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    memory_refs: list[str] = Field(default_factory=list)
    doc_refs: list[str] = Field(default_factory=list)


class HandoffCapsuleResponse(ApiModel):
    id: str
    project_id: str
    source_tool: str
    target_tool: str | None
    title: str
    goal: str | None
    current_state: str
    decisions_json: list[str]
    files_changed_json: list[str]
    commands_run_json: list[str]
    errors_seen_json: list[str]
    tests_run_json: list[str]
    next_steps_json: list[str]
    open_questions_json: list[str]
    warnings_json: list[str]
    memory_refs_json: list[str]
    doc_refs_json: list[str]
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class HandoffContinueRequest(ApiModel):
    app_id: str = "demo"
    target_tool: str | None = None


class HandoffContinueResponse(ApiModel):
    handoff_id: str
    project_id: str
    target_tool: str | None
    continuation_prompt: str


class ProjectContextResponse(ApiModel):
    project: ProjectResponse
    relevant_memories: list[MemoryResponse]
    docs: list[DocumentResponse]
    handoffs: list[HandoffCapsuleResponse]
    current_tasks: list[MemoryResponse]


class ApiKeyCreate(ApiModel):
    app_id: str = "demo"
    name: str = Field(min_length=1, max_length=128)
    role: Literal["owner", "admin", "developer", "viewer"] = "developer"


class ApiKeyResponse(ApiModel):
    id: str
    app_id: str
    name: str
    role: str
    key_prefix: str
    created_at: datetime
    created_by_actor: str | None = None
    revoked_at: datetime | None = None
    last_used_at: datetime | None = None
    plaintext: str | None = None


class AuditLogResponse(ApiModel):
    id: str
    app_id: str
    actor_user_id: str | None
    actor_role: str | None
    action: str
    resource_type: str
    resource_id: str | None
    metadata_json: dict[str, Any]
    created_at: datetime


class OpenAIMessage(ApiModel):
    role: str
    content: str


class OpenAIChatRequest(ApiModel):
    model: str = "n0tune/dev"
    messages: list[OpenAIMessage]
    stream: bool = False
    max_tokens: int | None = None
    temperature: float | None = None
    app_id: str | None = None
    user_id: str | None = None
    max_context_tokens: int = 1200
