"""Idempotent markdown-folder → N0Tune sync."""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from n0tune import N0TuneClient

logger = logging.getLogger(__name__)

DEFAULT_PATTERNS = ("*.md", "*.markdown")


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _walk_markdown(folder: Path, patterns: Iterable[str]) -> list[Path]:
    seen: set[Path] = set()
    for pattern in patterns:
        for path in folder.rglob(pattern):
            if path.is_file():
                seen.add(path.resolve())
    return sorted(seen)


@dataclass
class SyncReport:
    folder: str
    app_id: str
    scanned: int = 0
    uploaded: int = 0
    skipped_unchanged: int = 0
    failed: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "folder": self.folder,
            "app_id": self.app_id,
            "scanned": self.scanned,
            "uploaded": self.uploaded,
            "skipped_unchanged": self.skipped_unchanged,
            "failed": self.failed,
            "failures": list(self.failures),
        }


def sync_folder(
    folder: str | Path,
    *,
    client: N0TuneClient,
    app_id: str = "demo",
    patterns: Iterable[str] = DEFAULT_PATTERNS,
    source_prefix: str = "markdown://",
) -> SyncReport:
    """Walk ``folder``, upload new or changed markdown files, return a report.

    Files are matched against existing N0Tune documents by ``source``: the
    connector stores ``source = f"{source_prefix}{relative_path}"``. If a
    matching document already exists and shares the same content hash, the
    file is skipped.
    """
    root = Path(folder).resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"{folder!r} is not a directory")

    report = SyncReport(folder=str(root), app_id=app_id)
    existing = {doc.source: doc for doc in client.documents.list(app_id=app_id)}

    for path in _walk_markdown(root, patterns):
        report.scanned += 1
        relative = path.relative_to(root).as_posix()
        source = f"{source_prefix}{relative}"
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            report.failed += 1
            report.failures.append(f"{relative}: read failed ({exc})")
            continue

        digest = _content_hash(text)
        prior = existing.get(source)
        if prior is not None and prior.content_hash == digest:
            report.skipped_unchanged += 1
            continue

        # Title is the first markdown heading if we find one, else the file name.
        title = _extract_title(text) or path.stem

        try:
            client.documents.create(
                title=title,
                content=text,
                source=source,
                app_id=app_id,
                metadata_json={
                    "connector": "markdown-folder",
                    "relative_path": relative,
                    "content_hash": digest,
                },
            )
            report.uploaded += 1
        except Exception as exc:
            report.failed += 1
            report.failures.append(f"{relative}: upload failed ({exc})")
            logger.exception("upload failed for %s", relative)

    return report


def _extract_title(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()[:255]
    return None
