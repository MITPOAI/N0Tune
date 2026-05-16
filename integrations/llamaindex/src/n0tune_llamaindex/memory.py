"""A small LlamaIndex-friendly wrapper around the N0Tune memories API.

Like the LangChain counterpart, this is intentionally not a subclass of any
``BaseChatMemory``-style abstraction. N0Tune memories are distilled long-term
facts; chat-history abstractions track raw turns. ``N0TuneMemoryStore`` gives
you simple ``save``/``search``/``forget`` operations to call from your own
ingestion or post-call hook.
"""

from __future__ import annotations

from typing import Any

from n0tune import MemoryType, N0TuneClient


class N0TuneMemoryStore:
    def __init__(
        self,
        *,
        client: N0TuneClient,
        user_id: str,
        app_id: str = "demo",
    ) -> None:
        self._client = client
        self._user_id = user_id
        self._app_id = app_id

    def save(
        self,
        text: str,
        *,
        type: MemoryType = "fact",
        confidence: float = 0.8,
    ) -> dict[str, Any]:
        memory = self._client.memories.create(
            user_id=self._user_id,
            text=text,
            app_id=self._app_id,
            type=type,
            confidence=confidence,
        )
        return memory.model_dump(mode="json")

    def search(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        memories = self._client.memories.list(
            user_id=self._user_id,
            app_id=self._app_id,
            query=query,
            limit=limit,
        )
        return [memory.model_dump(mode="json") for memory in memories]

    def list(self, *, limit: int = 50) -> list[dict[str, Any]]:
        memories = self._client.memories.list(
            user_id=self._user_id, app_id=self._app_id, limit=limit
        )
        return [memory.model_dump(mode="json") for memory in memories]

    def forget(self, memory_id: str, *, hard: bool = False) -> dict[str, Any]:
        return self._client.memories.delete(memory_id, app_id=self._app_id, hard=hard)
