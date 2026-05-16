"""Tests for the markdown-folder connector.

The connector talks to N0Tune through the SDK. We stub the SDK's HTTP transport
so the suite stays in-process and keyless.
"""

from __future__ import annotations

import hashlib
import json as _json
from pathlib import Path

import httpx
import pytest
from n0tune import N0TuneClient

from n0tune_markdown_folder import sync_folder


def _build_client(handler) -> N0TuneClient:
    transport = httpx.MockTransport(handler)
    return N0TuneClient(base_url="http://n0tune.test", api_key="k", transport=transport)


def _seed_folder(tmp_path: Path) -> None:
    (tmp_path / "intro.md").write_text("# Intro\n\nA short doc.", encoding="utf-8")
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "deep.md").write_text("# Deep\n\nNested content.\n", encoding="utf-8")
    (tmp_path / "ignored.txt").write_text("not a markdown file", encoding="utf-8")


def _now_iso() -> str:
    return "2026-05-18T12:00:00+00:00"


def _document_response(*, id_: str, source: str, content: str) -> dict[str, object]:
    return {
        "id": id_,
        "app_id": "demo",
        "title": "stub",
        "source": source,
        "metadata_json": {},
        "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "deleted_at": None,
        "chunks": [],
    }


def test_sync_uploads_new_markdown_files(tmp_path: Path):
    _seed_folder(tmp_path)

    posted: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/v1/documents":
            return httpx.Response(200, json=[])
        if request.method == "POST" and request.url.path == "/v1/documents":
            body = _json.loads(request.content)
            posted.append(body)
            return httpx.Response(
                201,
                json=_document_response(
                    id_=f"doc_{len(posted)}",
                    source=body["source"],
                    content=body["content"],
                ),
            )
        return httpx.Response(404)

    client = _build_client(handler)
    report = sync_folder(tmp_path, client=client, app_id="demo")

    assert report.scanned == 2
    assert report.uploaded == 2
    assert report.skipped_unchanged == 0
    assert report.failed == 0

    sources = {entry["source"] for entry in posted}
    assert sources == {"markdown://intro.md", "markdown://nested/deep.md"}

    titles = {entry["title"] for entry in posted}
    assert titles == {"Intro", "Deep"}


def test_sync_skips_unchanged_files_on_second_run(tmp_path: Path):
    _seed_folder(tmp_path)
    first_path = tmp_path / "intro.md"
    second_path = tmp_path / "nested" / "deep.md"

    existing = [
        _document_response(
            id_="doc_existing_intro",
            source="markdown://intro.md",
            content=first_path.read_text(encoding="utf-8"),
        ),
        _document_response(
            id_="doc_existing_deep",
            source="markdown://nested/deep.md",
            content=second_path.read_text(encoding="utf-8"),
        ),
    ]
    posted: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/v1/documents":
            return httpx.Response(200, json=existing)
        if request.method == "POST" and request.url.path == "/v1/documents":
            body = _json.loads(request.content)
            posted.append(body)
            return httpx.Response(
                201,
                json=_document_response(
                    id_=f"doc_new_{len(posted)}",
                    source=body["source"],
                    content=body["content"],
                ),
            )
        return httpx.Response(404)

    client = _build_client(handler)
    report = sync_folder(tmp_path, client=client, app_id="demo")

    assert report.scanned == 2
    assert report.uploaded == 0
    assert report.skipped_unchanged == 2
    assert report.failed == 0
    assert posted == []


def test_sync_reuploads_changed_files(tmp_path: Path):
    intro = tmp_path / "intro.md"
    intro.write_text("# Intro\n\nv1", encoding="utf-8")

    stale_existing = [
        _document_response(
            id_="doc_stale",
            source="markdown://intro.md",
            content="# Intro\n\nv0",  # different hash from the current file
        )
    ]
    posted: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/v1/documents":
            return httpx.Response(200, json=stale_existing)
        if request.method == "POST" and request.url.path == "/v1/documents":
            body = _json.loads(request.content)
            posted.append(body)
            return httpx.Response(
                201,
                json=_document_response(
                    id_="doc_fresh",
                    source=body["source"],
                    content=body["content"],
                ),
            )
        return httpx.Response(404)

    client = _build_client(handler)
    report = sync_folder(tmp_path, client=client, app_id="demo")

    assert report.scanned == 1
    assert report.uploaded == 1
    assert report.skipped_unchanged == 0
    assert len(posted) == 1
    assert posted[0]["content"].endswith("v1")


def test_sync_records_failures_without_raising(tmp_path: Path):
    (tmp_path / "broken.md").write_text("# Broken\n\nbody", encoding="utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/v1/documents":
            return httpx.Response(200, json=[])
        return httpx.Response(503, json={"detail": "upstream down"})

    client = _build_client(handler)
    report = sync_folder(tmp_path, client=client, app_id="demo")

    assert report.scanned == 1
    assert report.uploaded == 0
    assert report.failed == 1
    assert any("broken.md" in failure for failure in report.failures)


def test_sync_rejects_missing_folder(tmp_path: Path):
    missing = tmp_path / "does-not-exist"
    client = _build_client(lambda request: httpx.Response(404))
    with pytest.raises(NotADirectoryError):
        sync_folder(missing, client=client, app_id="demo")
