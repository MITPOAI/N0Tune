"""Thin LangChain-friendly helper around the N0Tune memories API.

N0Tune memories model long-term user preferences, goals, and corrections —
deliberately not raw chat turns. Most LangChain users want that semantic on the
read path (e.g. a retriever) and a simple ``save``/``list``/``forget`` API on
the write path. ``N0TuneMemoryStore`` is that simple API; it does not subclass
LangChain's deprecated ``BaseChatMemory`` because the data shapes do not align.

To plug the memories into a chain, retrieve them with ``N0TuneRetriever`` and
write new ones with this store from your own callback or post-call hook.
"""

from __future__ import annotations

from typing import Any

from n0tune import MemoryType, N0TuneClient


class N0TuneMemoryStore:
    """Lightweight wrapper around the N0Tune memories API.

    >>> from n0tune import N0TuneClient
    >>> from n0tune_langchain import N0TuneMemoryStore
    >>> store = N0TuneMemoryStore(client=N0TuneClient(), user_id="user_1")
    >>> store.save("User prefers short architecture answers.", type="preference")
    >>> store.search("architecture")
    """

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
