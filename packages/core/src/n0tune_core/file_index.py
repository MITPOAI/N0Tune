"""File-memory helpers used by both Desktop and Gateway.

We deliberately keep this in pure Python — no Tauri, no Rust — so it can
run in tests and so the Gateway can reuse the same walker/chunker for the
Markdown connector. The Desktop's Rust side will eventually call
``walk_folder`` from a worker thread.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_PATTERNS = ("*.md", "*.markdown", "*.txt")

# Files larger than this are skipped to keep ingestion predictable. Real
# documents are almost always smaller; anything bigger is probably an
# accidental binary blob in a docs folder.
MAX_FILE_BYTES = 2_000_000


@dataclass
class FileChunk:
    text: str
    chunk_index: int
    source: str
    content_hash: str
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass
class WalkResult:
    chunks: list[FileChunk] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def walk_folder(
    folder: str | Path,
    *,
    patterns: Iterable[str] = DEFAULT_PATTERNS,
    chunk_chars: int = 900,
    source_prefix: str = "local://",
) -> WalkResult:
    """Walk ``folder`` and return chunked text + a skipped list.

    Skipping is recorded (with the reason) rather than swallowed so callers
    can report what didn't make it in. The chunker matches the Gateway's
    Markdown chunker so both surfaces agree on chunk boundaries.
    """
    root = Path(folder).resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"{folder!r} is not a directory")

    result = WalkResult()
    seen: set[Path] = set()
    for pattern in patterns:
        for path in root.rglob(pattern):
            if not path.is_file():
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)

            try:
                stat = resolved.stat()
            except OSError as exc:
                result.skipped.append(f"{path}: stat failed ({exc})")
                continue
            if stat.st_size > MAX_FILE_BYTES:
                result.skipped.append(
                    f"{path}: {stat.st_size} bytes exceeds {MAX_FILE_BYTES}"
                )
                continue

            try:
                text = resolved.read_text(encoding="utf-8")
            except OSError as exc:
                result.skipped.append(f"{path}: read failed ({exc})")
                continue
            except UnicodeDecodeError:
                result.skipped.append(f"{path}: not utf-8")
                continue

            text = text.strip()
            if not text:
                result.skipped.append(f"{path}: empty")
                continue

            relative = resolved.relative_to(root).as_posix()
            source = f"{source_prefix}{relative}"
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            for index, chunk in enumerate(chunk_text(text, chunk_chars=chunk_chars)):
                result.chunks.append(
                    FileChunk(
                        text=chunk,
                        chunk_index=index,
                        source=source,
                        content_hash=content_hash,
                        metadata={
                            "relative_path": relative,
                            "file_size_bytes": stat.st_size,
                        },
                    )
                )
    return result


def chunk_text(text: str, *, chunk_chars: int = 900) -> list[str]:
    """Paragraph-first chunker matching the Markdown connector's heuristic."""
    paragraphs = [block.strip() for block in text.split("\n\n") if block.strip()]
    if not paragraphs:
        paragraphs = [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = ""
        while len(paragraph) > chunk_chars:
            split_at = paragraph.rfind(" ", 0, chunk_chars)
            if split_at < chunk_chars // 2:
                split_at = chunk_chars
            chunks.append(paragraph[:split_at].strip())
            paragraph = paragraph[split_at:].strip()
        current = paragraph
    if current:
        chunks.append(current)
    return chunks
