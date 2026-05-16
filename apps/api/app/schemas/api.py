from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MemoryCreate(ApiModel):
    app_id: str = "demo"
    user_id: str
    type: Literal["preference", "goal", "project", "correction", "style", "fact"] = "fact"
    text: str = Field(min_length=1, max_length=4000)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    source_message_id: str | None = None
    expires_at: datetime | None = None


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
    expires_at: datetime | None
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
