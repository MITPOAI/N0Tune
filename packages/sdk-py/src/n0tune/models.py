"""Pydantic v2 models mirroring the public N0Tune API schemas.

These are not generated — the project is too small to be worth that — but they
match the field names used by ``apps/api/app/schemas/api.py``. If you change a
field over there, mirror the change here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

MemoryType = Literal["preference", "goal", "project", "correction", "style", "fact"]


class _ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")


class MemoryCreate(_ApiModel):
    app_id: str = "demo"
    user_id: str
    type: MemoryType = "fact"
    text: str
    confidence: float = 0.8
    source_message_id: str | None = None
    expires_at: datetime | None = None


class MemoryUpdate(_ApiModel):
    app_id: str = "demo"
    text: str | None = None
    type: MemoryType | None = None
    confidence: float | None = None
    expires_at: datetime | None = None


class MemoryResponse(_ApiModel):
    id: str
    app_id: str
    user_id: str
    type: str
    text: str
    confidence: float
    source_message_id: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    similarity: float | None = None


class StylePatch(_ApiModel):
    app_id: str = "demo"
    profile_json: dict[str, Any] = Field(default_factory=dict)


class StyleResponse(_ApiModel):
    id: str
    app_id: str
    user_id: str
    profile_json: dict[str, Any]
    updated_at: datetime


class DocumentCreate(_ApiModel):
    app_id: str = "demo"
    title: str
    source: str = "api"
    content: str
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class ChunkResponse(_ApiModel):
    id: str
    document_id: str
    chunk_index: int
    text: str
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    injection_risk_score: float
    injection_risk_reasons_json: list[str] = Field(default_factory=list)
    similarity: float | None = None


class DocumentResponse(_ApiModel):
    id: str
    app_id: str
    title: str
    source: str
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    content_hash: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    chunks: list[ChunkResponse] = Field(default_factory=list)


class TraceItem(_ApiModel):
    type: str
    id: str
    reason: str


class ContextTrace(_ApiModel):
    why_selected: list[TraceItem] = Field(default_factory=list)
    excluded: list[TraceItem] = Field(default_factory=list)


class ContextPreviewRequest(_ApiModel):
    app_id: str = "demo"
    user_id: str
    message: str
    model: str = "n0tune/dev"
    max_context_tokens: int = 1200


class ContextPreviewResponse(_ApiModel):
    compiled_context: str
    selected_memories: list[MemoryResponse]
    selected_chunks: list[ChunkResponse]
    style_profile: dict[str, Any]
    cache_hit: bool = False
    prompt_tokens_estimated: int
    tokens_saved_estimated: int
    warnings: list[str] = Field(default_factory=list)
    context_trace: ContextTrace


class ChatRequest(ContextPreviewRequest):
    allow_cache: bool = True


class ChatContext(_ApiModel):
    cache_hit: bool
    memories_used: list[MemoryResponse]
    chunks_used: list[ChunkResponse]
    style_profile: dict[str, Any]
    prompt_tokens_estimated: int
    tokens_saved_estimated: int
    warnings: list[str] = Field(default_factory=list)


class ChatResponse(_ApiModel):
    answer: str
    provider: str
    context: ChatContext


class CacheEntry(_ApiModel):
    id: str
    app_id: str
    user_id: str | None = None
    input_hash: str
    answer: str
    model: str
    context_hash: str
    depends_on_json: dict[str, Any] = Field(default_factory=dict)
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CacheListResponse(_ApiModel):
    entries: list[CacheEntry]
    total: int
