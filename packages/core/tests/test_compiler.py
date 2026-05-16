from n0tune_core.compiler import (
    UNTRUSTED_CONTEXT_WARNING,
    DocumentChunkContext,
    MemoryContext,
    build_compiled_context,
    estimate_naive_tokens,
)


def test_build_compiled_context_renders_style_memory_chunks_and_message() -> None:
    compiled = build_compiled_context(
        style_profile={"tone": "direct"},
        memories=[MemoryContext(id="mem_1", type="preference", text="User likes bullets.")],
        chunks=[
            DocumentChunkContext(
                id="chunk_1",
                document_id="doc_1",
                chunk_index=0,
                text="RAG retrieves documents.",
            )
        ],
        message="Explain RAG.",
    )

    assert UNTRUSTED_CONTEXT_WARNING in compiled
    assert "User likes bullets." in compiled
    assert "RAG retrieves documents." in compiled
    assert "Explain RAG." in compiled


def test_build_compiled_context_renders_none_for_empty_context() -> None:
    compiled = build_compiled_context(
        style_profile={},
        memories=[],
        chunks=[],
        message="Hello.",
    )
    assert "Selected memories:\n- none" in compiled
    assert "Retrieved document chunks:\n- none" in compiled


def test_estimate_naive_tokens_includes_all_candidate_text() -> None:
    estimate = estimate_naive_tokens(
        memory_texts=["memory one", "memory two"],
        chunk_texts=["chunk one"],
        message="current message",
    )
    assert estimate > 0
