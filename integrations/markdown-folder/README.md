# n0tune-markdown-folder

The first N0Tune connector: walk a folder of Markdown files and sync them
into your N0Tune deployment as documents.

```bash
pip install n0tune-markdown-folder
```

## CLI

```bash
n0tune-markdown-sync ./docs \
  --base-url http://localhost:8000 \
  --api-key replace-with-local-development-key \
  --app-id demo
```

Output is a JSON report:

```json
{
  "folder": "/abs/path/to/docs",
  "app_id": "demo",
  "scanned": 47,
  "uploaded": 12,
  "skipped_unchanged": 35,
  "failed": 0,
  "failures": []
}
```

## What it does

- Walks every `*.md` and `*.markdown` file under the given folder (recursively).
- Computes a SHA-256 of the file contents.
- Looks at N0Tune's existing documents for matching `source` (the connector
  stores `source = "markdown://<relative-path>"`).
- Uploads files that are new or whose content hash differs.
- Skips files where the hash already matches — sync is idempotent.

The first heading (`# Title`) becomes the document title; otherwise the file
stem is used.

## Library use

```python
from n0tune import N0TuneClient
from n0tune_markdown_folder import sync_folder

client = N0TuneClient(base_url="http://localhost:8000", api_key="...")
report = sync_folder("./docs", client=client, app_id="demo")
print(report.as_dict())
```

`sync_folder` returns a `SyncReport` dataclass:

```python
@dataclass
class SyncReport:
    folder: str
    app_id: str
    scanned: int
    uploaded: int
    skipped_unchanged: int
    failed: int
    failures: list[str]
```

## What this is not

- Not a watcher. The connector is a one-shot sync; wire it into a cron job
  or a file watcher if you want continuous syncing.
- Not a deletion tracker. Files removed from disk stay in N0Tune until you
  delete them explicitly. The next connector iteration will support a
  `--prune` mode that soft-deletes documents whose source no longer exists.
- Not a renderer. N0Tune ingests Markdown as-is; the compiler doesn't care
  about heading levels or link syntax.

## Development

```bash
pip install -e "integrations/markdown-folder[dev]"
pytest integrations/markdown-folder
ruff check integrations/markdown-folder
```
