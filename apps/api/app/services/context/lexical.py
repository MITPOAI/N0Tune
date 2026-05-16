"""Gateway compatibility wrapper for N0Tune Core lexical scoring."""

from n0tune_core.lexical import bm25_scores, normalize_scores, tokenize

__all__ = ["bm25_scores", "normalize_scores", "tokenize"]
