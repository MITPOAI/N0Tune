# n0tune — Python SDK

Official Python client for [N0Tune](https://github.com/n0tune/n0tune), the
open-source Context Compiler and AI Memory Gateway.

```bash
pip install n0tune
```

## Quick start

```python
from n0tune import N0TuneClient

with N0TuneClient(base_url="http://localhost:8000", api_key="local-dev-key") as client:
    client.memories.create(
        user_id="user_1",
        text="User prefers concise architecture answers.",
        type="preference",
        confidence=0.92,
    )

    preview = client.context.preview(
        user_id="user_1",
        message="Explain RAG like before.",
    )
    print(preview.compiled_context)
    print("tokens saved:", preview.tokens_saved_estimated)

    chat = client.chat.create(user_id="user_1", message="Explain RAG like before.")
    print(chat.answer)
```

## Resources

The client exposes six resource namespaces that mirror the public REST API:

| Resource         | Methods                                                  |
| ---------------- | -------------------------------------------------------- |
| `memories`       | `create`, `list`, `update`, `delete`                     |
| `style`          | `get`, `update`                                          |
| `documents`      | `create`, `list`, `delete`                               |
| `context`        | `preview`                                                |
| `chat`           | `create`                                                 |
| `cache`          | `list`, `clear`                                          |

All responses are typed `pydantic` v2 models — use them directly or call
`model_dump()` for plain dicts.

## Errors

Any non-2xx response raises `N0TuneError` with the HTTP status code and the
decoded response body.

```python
from n0tune import N0TuneError

try:
    client.memories.delete("does-not-exist")
except N0TuneError as exc:
    print(exc.status_code, exc.body)
```

## Authentication

Pass your app API key as `api_key=` when constructing the client. The SDK sends
it both as the `X-N0Tune-API-Key` header and as `Authorization: Bearer <key>`
so it works against either of N0Tune's accepted authentication mechanisms.

## Development

```bash
pip install -e "packages/sdk-py[dev]"
pytest packages/sdk-py
ruff check packages/sdk-py
mypy packages/sdk-py/src
```

Tests use `httpx.MockTransport` to assert outbound request shapes without
booting the API.
