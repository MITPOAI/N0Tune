"""One-shot doc seeder.

Reads every *.md under docs/ and POSTs to /v1/documents so the chunk pool
is wide enough that retrieval has real competition. Idempotency is best-
effort: it tags metadata with the source path; the server side dedupes by
content hash if it does so at all.
"""

from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"
DOCS = pathlib.Path(r"C:/Dev/IMME internal/N0Tune/docs")


def post_doc(path: pathlib.Path) -> tuple[bool, str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    if not text.strip():
        return False, "empty"
    title = (text.splitlines()[0].lstrip("# ").strip() or path.stem)[:200]
    body = {
        "app_id": "demo",
        "title": title,
        "source": f"docs/{path.relative_to(DOCS).as_posix()}",
        "content": text[:190_000],
        "metadata_json": {"path": path.relative_to(DOCS).as_posix()},
    }
    req = urllib.request.Request(
        f"{BASE}/v1/documents",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "X-N0Tune-API-Key": "replace-with-local-development-key",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
            return True, data.get("id", "?")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read()[:200].decode(errors='ignore')}"
    except Exception as e:  # pragma: no cover
        return False, f"err: {e!r}"


def main() -> int:
    paths = sorted(p for p in DOCS.rglob("*.md") if p.is_file())
    print(f"found {len(paths)} markdown files")
    ok = 0
    for p in paths:
        success, msg = post_doc(p)
        marker = "+" if success else "x"
        print(f" {marker} {p.relative_to(DOCS).as_posix():45s} -> {msg}")
        if success:
            ok += 1
    print(f"done: {ok}/{len(paths)} indexed")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
