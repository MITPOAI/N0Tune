"""Tests for the file-memory walker."""

from __future__ import annotations

import pytest

from n0tune_core.file_index import (
    DEFAULT_PATTERNS,
    FileChunk,
    chunk_text,
    walk_folder,
)


def test_chunk_text_keeps_paragraphs_when_small() -> None:
    text = "alpha line\n\nbeta line\n\ngamma line"
    chunks = chunk_text(text, chunk_chars=500)
    assert chunks == [text]


def test_chunk_text_splits_long_paragraphs() -> None:
    long_paragraph = "word " * 400  # ~2000 chars
    chunks = chunk_text(long_paragraph, chunk_chars=300)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 300 + 10  # tolerate the boundary fudge


def test_walk_folder_picks_md_and_txt_skips_other(tmp_path) -> None:
    (tmp_path / "intro.md").write_text("# Intro\n\nA short doc.", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("Plain text notes.\n", encoding="utf-8")
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "deep.markdown").write_text("# Deep\n\nNested.", encoding="utf-8")
    # Non-matching pattern; should be skipped silently.
    (tmp_path / "ignored.png").write_bytes(b"\x89PNG fake")
    # Empty file is reported in `skipped`.
    (tmp_path / "empty.md").write_text("", encoding="utf-8")

    result = walk_folder(tmp_path, patterns=DEFAULT_PATTERNS)

    sources = {chunk.source for chunk in result.chunks}
    assert sources == {
        "local://intro.md",
        "local://notes.txt",
        "local://nested/deep.markdown",
    }
    assert all(isinstance(chunk, FileChunk) for chunk in result.chunks)
    assert any("empty.md" in entry for entry in result.skipped)


def test_walk_folder_records_too_large_files(tmp_path) -> None:
    big = tmp_path / "huge.md"
    big.write_text("x" * (3_000_000), encoding="utf-8")
    result = walk_folder(tmp_path)
    assert result.chunks == []
    assert any("exceeds" in entry for entry in result.skipped)


def test_walk_folder_skips_non_utf8(tmp_path) -> None:
    bad = tmp_path / "binary.md"
    bad.write_bytes(b"\xff\xfeNotUTF8\x00")
    good = tmp_path / "ok.md"
    good.write_text("# OK\n\nbody", encoding="utf-8")

    result = walk_folder(tmp_path)
    sources = {chunk.source for chunk in result.chunks}
    assert sources == {"local://ok.md"}
    assert any("not utf-8" in entry for entry in result.skipped)


def test_walk_folder_rejects_missing_path(tmp_path) -> None:
    with pytest.raises(NotADirectoryError):
        walk_folder(tmp_path / "does-not-exist")
