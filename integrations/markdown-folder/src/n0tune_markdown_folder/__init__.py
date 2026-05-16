"""Markdown folder connector for N0Tune.

Walks a directory of ``.md`` / ``.markdown`` files, hashes each one's content,
and posts it to ``POST /v1/documents``. Subsequent syncs only re-upload files
whose content hash changed.
"""

from __future__ import annotations

from n0tune_markdown_folder.sync import SyncReport, sync_folder

__version__ = "0.1.0"
__all__ = ["SyncReport", "__version__", "sync_folder"]
