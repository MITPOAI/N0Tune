"""LangChain ``BaseRetriever`` backed by the N0Tune context-preview endpoint."""

from __future__ import annotations

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from n0tune import N0TuneClient
from pydantic import ConfigDict


class N0TuneRetriever(BaseRetriever):
    """Return compiled context (memories + chunks) as LangChain ``Document`` objects.

    Each returned ``Document`` carries ``metadata["kind"]`` of either
    ``"memory"`` or ``"chunk"`` so downstream chains can tell the two apart. The
    similarity score and the relevant N0Tune ids are mirrored into metadata so
    callers can rank, filter, or surface provenance.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    client: N0TuneClient
    user_id: str
    app_id: str = "demo"
    model: str = "n0tune/dev"
    max_context_tokens: int = 1200

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> list[Document]:
        preview = self.client.context.preview(
            user_id=self.user_id,
            message=query,
            app_id=self.app_id,
            model=self.model,
            max_context_tokens=self.max_context_tokens,
        )
        documents: list[Document] = []
        for memory in preview.selected_memories:
            documents.append(
                Document(
                    page_content=memory.text,
                    metadata={
                        "kind": "memory",
                        "memory_id": memory.id,
                        "memory_type": memory.type,
                        "confidence": memory.confidence,
                        "similarity": memory.similarity,
                    },
                )
            )
        for chunk in preview.selected_chunks:
            documents.append(
                Document(
                    page_content=chunk.text,
                    metadata={
                        "kind": "chunk",
                        "chunk_id": chunk.id,
                        "document_id": chunk.document_id,
                        "chunk_index": chunk.chunk_index,
                        "injection_risk_score": chunk.injection_risk_score,
                        "similarity": chunk.similarity,
                    },
                )
            )
        return documents
