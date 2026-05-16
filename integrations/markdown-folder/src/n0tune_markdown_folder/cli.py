"""``n0tune-markdown-sync`` CLI."""

from __future__ import annotations

import argparse
import json
import sys

from n0tune import N0TuneClient

from n0tune_markdown_folder.sync import sync_folder


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="n0tune-markdown-sync",
        description="Sync a folder of Markdown files into N0Tune.",
    )
    parser.add_argument("folder", help="Folder to sync (recursively).")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="N0Tune API base URL.",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="N0Tune API key. Required if N0TUNE_REQUIRE_API_KEY=true.",
    )
    parser.add_argument(
        "--app-id",
        default="demo",
        help="N0Tune app id.",
    )
    parser.add_argument(
        "--source-prefix",
        default="markdown://",
        help="Prefix prepended to the relative file path in the document's `source` field.",
    )
    args = parser.parse_args(argv)

    client = N0TuneClient(base_url=args.base_url, api_key=args.api_key)
    try:
        report = sync_folder(
            args.folder,
            client=client,
            app_id=args.app_id,
            source_prefix=args.source_prefix,
        )
    finally:
        client.close()

    sys.stdout.write(json.dumps(report.as_dict(), indent=2) + "\n")
    return 0 if report.failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
