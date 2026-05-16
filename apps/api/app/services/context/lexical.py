"""Lightweight in-memory BM25 used as the lexical leg of hybrid retrieval.

We deliberately keep this in pure Python rather than relying on Postgres
``tsvector``: the compiler already pulls candidate memories and chunks into
memory, the candidate sets are small, and the same code path then works on the
SQLite test backend. Swapping in native ``tsvector`` queries is a future
improvement once corpora outgrow the in-process scoring loop.
"""

from __future__ import annotations

from collections import Counter
from math import log
from re import findall


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in findall(r"[a-zA-Z0-9]+", text) if len(token) > 1]


def bm25_scores(
    query: str,
    documents: list[str],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[float]:
    """Return one BM25 score per document, in the same order as ``documents``."""
    if not query or not documents:
        return [0.0] * len(documents)

    query_tokens = tokenize(query)
    if not query_tokens:
        return [0.0] * len(documents)

    tokenized_docs = [tokenize(doc) for doc in documents]
    doc_counters = [Counter(tokens) for tokens in tokenized_docs]
    doc_lengths = [len(tokens) for tokens in tokenized_docs]
    total = len(documents)
    avg_dl = sum(doc_lengths) / total if total else 0.0

    document_frequency: dict[str, int] = {}
    for counter in doc_counters:
        for term in counter:
            document_frequency[term] = document_frequency.get(term, 0) + 1

    scores: list[float] = []
    for counter, dl in zip(doc_counters, doc_lengths, strict=False):
        score = 0.0
        if dl == 0 or avg_dl == 0:
            scores.append(0.0)
            continue
        for term in query_tokens:
            df = document_frequency.get(term, 0)
            if df == 0:
                continue
            idf = log((total - df + 0.5) / (df + 0.5) + 1.0)
            tf = counter.get(term, 0)
            if tf == 0:
                continue
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * (dl / avg_dl))
            score += idf * numerator / denominator
        scores.append(score)
    return scores


def normalize_scores(scores: list[float]) -> list[float]:
    if not scores:
        return []
    minimum = min(scores)
    maximum = max(scores)
    if maximum <= 0:
        return [0.0] * len(scores)
    if maximum == minimum:
        return [1.0] * len(scores)
    span = maximum - minimum
    return [(value - minimum) / span for value in scores]
