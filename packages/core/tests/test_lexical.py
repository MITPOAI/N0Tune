from n0tune_core.compiler import blend_scores
from n0tune_core.lexical import bm25_scores, normalize_scores, tokenize


def test_tokenize_keeps_meaningful_terms() -> None:
    assert tokenize("RAG, AI, and context-tuning.") == ["rag", "ai", "and", "context", "tuning"]


def test_bm25_promotes_keyword_match() -> None:
    scores = bm25_scores(
        "lemniscate",
        [
            "alpha bravo charlie",
            "the lemniscate keyword appears here",
        ],
    )
    assert scores[1] > scores[0]


def test_normalize_scores_handles_flat_and_negative_values() -> None:
    assert normalize_scores([]) == []
    assert normalize_scores([0.0, 0.0]) == [0.0, 0.0]
    assert normalize_scores([2.0, 2.0]) == [1.0, 1.0]


def test_blend_scores_clamps_lexical_weight() -> None:
    scores = blend_scores("target", ["target", "other"], [0.0, 1.0], lexical_weight=2.0)
    assert scores[0] > scores[1]
