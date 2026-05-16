from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol

from n0tune_core.compiler import CompiledContext


class MemoryStore(Protocol):
    def add_memory(self, input: Any) -> Any:
        ...

    def search_memories(self, query: Any) -> Sequence[Any]:
        ...

    def list_memories(self, query: Any) -> Sequence[Any]:
        ...

    def delete_memory(self, id: str) -> None:
        ...

    def export_memories(self, query: Any) -> Any:
        ...


class StyleStore(Protocol):
    def get_style_profile(self, scope: Any) -> dict[str, Any] | None:
        ...

    def update_style_profile(self, input: Any) -> dict[str, Any]:
        ...


class DocumentStore(Protocol):
    def add_document(self, input: Any) -> Any:
        ...

    def search_documents(self, query: Any) -> Sequence[Any]:
        ...

    def delete_document(self, id: str) -> None:
        ...


class ProviderRouter(Protocol):
    def list_providers(self) -> Sequence[Any]:
        ...

    async def call_model(self, input: Any) -> Any:
        ...

    def validate_config(self, input: Any) -> Any:
        ...


class ContextCompiler(Protocol):
    def compile_context(self, input: Any) -> CompiledContext:
        ...

    def explain_trace(self, id: str) -> Any:
        ...

    def estimate_tokens(self, input: str) -> int:
        ...


class SecurityScanner(Protocol):
    def scan_prompt_injection(self, input: str) -> Any:
        ...

    def scan_secrets(self, input: str) -> list[str]:
        ...


class CacheStore(Protocol):
    def get_similar(self, input: Any) -> Any | None:
        ...

    def set(self, input: Any) -> None:
        ...

    def invalidate(self, input: Any) -> None:
        ...
