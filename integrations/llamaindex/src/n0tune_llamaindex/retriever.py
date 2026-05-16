"""LlamaIndex retriever backed by the N0Tune context-preview endpoint."""

from __future__ import annotations

from typing import Any

from llama_index.core.callbacks.base import CallbackManager
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle, TextNode
from n0tune import N0TuneClient


class N0TuneRetriever(BaseRetriever):
    """Return compiled context (memories + chunks) as LlamaIndex ``NodeWithScore`` objects.

    Each returned node carries ``metadata["kind"]`` of either ``"memory"`` or
    ``"chunk"`` so downstream pipelines can branch on it. Similarity values
    surface as the node score.
    """

    def __init__(
        self,
        *,
        client: N0TuneClient,
        user_id: str,
        app_id: str = "demo",
        model: str = "n0tune/dev",
        max_context_tokens: int = 1200,
        callback_manager: CallbackManager | None = None,
    ) -> None:
        super().__init__(callback_manager=callback_manager)
        self._client = client
        self._user_id = user_id
        self._app_id = app_id
        self._model = model
        self._max_context_tokens = max_context_tokens

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        preview = self._client.context.preview(
            user_id=self._user_id,
            message=query_bundle.query_str,
            app_id=self._app_id,
            model=self._model,
            max_context_tokens=self._max_context_tokens,
        )
        nodes: list[NodeWithScore] = []
        for memory in preview.selected_memories:
            metadata: dict[str, Any] = {
                "kind": "memory",
                "memory_id": memory.id,
                "memory_type": memory.type,
                "confidence": memory.confidence,
            }
            node = TextNode(text=memory.text, id_=memory.id, metadata=metadata)
            nodes.append(NodeWithScore(node=node, score=memory.similarity))
        for chunk in preview.selected_chunks:
            metadata = {
                "kind": "chunk",
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "injection_risk_score": chunk.injection_risk_score,
            }
            node = TextNode(text=chunk.text, id_=chunk.id, metadata=metadata)
            nodes.append(NodeWithScore(node=node, score=chunk.similarity))
        return nodes
