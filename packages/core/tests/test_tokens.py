from n0tune_core.tokens import cosine_similarity, estimate_tokens, hash_embedding, stable_hash


def test_estimate_tokens_is_stable_and_nonzero_for_text() -> None:
    assert estimate_tokens("") == 0
    assert estimate_tokens("hello") == 1
    assert estimate_tokens("x" * 40) == 10


def test_stable_hash_normalizes_whitespace_and_case() -> None:
    assert stable_hash("  Hello   World ") == stable_hash("hello world")


def test_hash_embedding_has_requested_dimensions_and_unitish_length() -> None:
    vector = hash_embedding("hello world hello", dimensions=16)
    assert len(vector) == 16
    assert any(value != 0 for value in vector)
    assert cosine_similarity(vector, vector) > 0.99


def test_cosine_similarity_handles_empty_inputs() -> None:
    assert cosine_similarity(None, [1.0]) == 0.0
    assert cosine_similarity([], [1.0]) == 0.0
