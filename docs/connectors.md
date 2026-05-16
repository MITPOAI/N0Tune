# Connectors

A connector pulls content from a source system (filesystem, GitHub, Notion,
Slack...) and pushes it into N0Tune via the documents API. We deliberately
ship **one** connector for v1.0 — the Markdown folder connector — and leave
the rest for future iterations.

## What's shipped

| Connector                                                                | Status      | Source field prefix |
| ------------------------------------------------------------------------ | ----------- | ------------------- |
| [Markdown folder](../integrations/markdown-folder/)                      | ✅ shipped  | `markdown://`       |
| GitHub repository                                                        | 🚧 planned | `github://`         |
| Notion                                                                   | 🚧 planned | `notion://`         |
| Google Drive                                                             | 🚧 planned | `drive://`          |
| Slack channel archive                                                    | 🚧 planned | `slack://`          |
| Generic website crawler                                                  | 🚧 planned | `https://`          |

If you need one of the planned connectors today, open a feature request
under [.github/ISSUE_TEMPLATE/feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml).

## The connector contract

A connector is anything that:

1. **Enumerates** items from its source system.
2. **Hashes** the content so re-syncs can skip unchanged items.
3. **Stamps** each item's `source` field with a stable, prefixed URI so the
   connector can find its prior uploads on the next run.
4. **Calls `POST /v1/documents`** via the N0Tune SDK or HTTP.

The reference implementation in
[`integrations/markdown-folder/src/n0tune_markdown_folder/sync.py`](../integrations/markdown-folder/src/n0tune_markdown_folder/sync.py)
is ~80 lines. New connectors should follow the same shape:

```python
from dataclasses import dataclass

@dataclass
class SyncReport:
    scanned: int
    uploaded: int
    skipped_unchanged: int
    failed: int
    failures: list[str]

def sync(...) -> SyncReport:
    existing = {doc.source: doc for doc in client.documents.list(app_id=app_id)}
    for item in enumerate_source_items():
        digest = hash(item.content)
        prior = existing.get(item.source_uri)
        if prior is not None and prior.content_hash == digest:
            # skip
            continue
        client.documents.create(
            title=item.title,
            content=item.content,
            source=item.source_uri,
            app_id=app_id,
            metadata_json={"connector": "...", ...},
        )
```

Return a `SyncReport`-shaped dataclass so the CLI can JSON-dump it.

## Operational notes

- **Idempotency.** Re-running a sync should be cheap. The Markdown
  connector skips files whose content hash matches their N0Tune row's
  `content_hash`.
- **Deletes.** None of the shipped connectors prune. If you remove a file
  from disk, the existing N0Tune document stays until you delete it
  explicitly. A `--prune` mode is on the roadmap.
- **Secrets.** Connector configuration (API tokens, source paths) belongs
  in environment variables, not in source code or scenario files. The
  Markdown connector accepts an `--api-key` flag for the N0Tune side; the
  source-system side is just the filesystem.
- **Permissions.** Each connector authenticates with its own N0Tune API
  key. Mint a `developer`-role key per connector via
  `POST /v1/api-keys` ([permissions.md](permissions.md)) so the audit
  log captures which connector wrote which document.

## Try it now

```bash
# Index this repo's own docs into your local N0Tune deployment.
n0tune-markdown-sync ./docs \
  --base-url http://localhost:8000 \
  --api-key replace-with-local-development-key \
  --app-id demo
```

Output is a JSON report ending with `"failed": 0` when everything went
through. The next run will report `"skipped_unchanged"` equal to the
file count.
