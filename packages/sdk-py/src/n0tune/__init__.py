"""Official Python SDK for N0Tune.

Quick start:

    from n0tune import N0TuneClient

    client = N0TuneClient(base_url="http://localhost:8000", api_key="...")
    client.memories.create(user_id="user_1", text="User prefers concise answers.")
    preview = client.context.preview(user_id="user_1", message="Explain RAG")
    print(preview.compiled_context)
"""

from __future__ import annotations

from n0tune.client import N0TuneClient, N0TuneError
from n0tune.models import (
    CacheEntry,
    CacheListResponse,
    ChatContext,
    ChatRequest,
    ChatResponse,
    ChunkResponse,
    ContextPreviewRequest,
    ContextPreviewResponse,
    ContextTrace,
    DocumentCreate,
    DocumentResponse,
    MemoryCreate,
    MemoryResponse,
    MemoryType,
    MemoryUpdate,
    StylePatch,
    StyleResponse,
    TraceItem,
)

__version__ = "0.1.0"

__all__ = [
    "CacheEntry",
    "CacheListResponse",
    "ChatContext",
    "ChatRequest",
    "ChatResponse",
    "ChunkResponse",
    "ContextPreviewRequest",
    "ContextPreviewResponse",
    "ContextTrace",
    "DocumentCreate",
    "DocumentResponse",
    "MemoryCreate",
    "MemoryResponse",
    "MemoryType",
    "MemoryUpdate",
    "N0TuneClient",
    "N0TuneError",
    "StylePatch",
    "StyleResponse",
    "TraceItem",
    "__version__",
]
