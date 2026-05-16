# API

Base URL:

```text
http://localhost:8000
```

## Health

```http
GET /health
GET /health?deep=true
```

Deep health checks database and Redis.

## Memories

```http
POST /v1/memories
GET /v1/memories?app_id=demo&user_id=user_123&q=rag
PATCH /v1/memories/{memory_id}
DELETE /v1/memories/{memory_id}?app_id=demo
```

Create:

```json
{
  "app_id": "demo",
  "user_id": "user_123",
  "type": "preference",
  "text": "User prefers concise architecture answers.",
  "confidence": 0.9,
  "expires_at": null
}
```

Memory text is rejected if it looks like a secret.

## Style Profile

```http
GET /v1/users/{user_id}/style?app_id=demo
PATCH /v1/users/{user_id}/style
```

Patch:

```json
{
  "app_id": "demo",
  "profile_json": {
    "tone": "direct",
    "depth": "medium",
    "format": "short sections",
    "avoid": ["hype"]
  }
}
```

## Documents

```http
POST /v1/documents
GET /v1/documents?app_id=demo&q=context
DELETE /v1/documents/{document_id}?app_id=demo
```

Create:

```json
{
  "app_id": "demo",
  "title": "Architecture notes",
  "source": "docs/architecture.md",
  "content": "Document text...",
  "metadata_json": {
    "section": "architecture"
  }
}
```

The API chunks documents, embeds chunks, scores prompt-injection risk, and stores source metadata.

## Context Preview

```http
POST /v1/context/preview
```

Request:

```json
{
  "app_id": "demo",
  "user_id": "user_123",
  "message": "Explain RAG like before",
  "max_context_tokens": 1200
}
```

Response includes:

- `compiled_context`
- `selected_memories`
- `selected_chunks`
- `style_profile`
- `prompt_tokens_estimated`
- `tokens_saved_estimated`
- `warnings`
- `context_trace`

## Chat

```http
POST /v1/chat
```

Request:

```json
{
  "app_id": "demo",
  "user_id": "user_123",
  "message": "Explain RAG like before",
  "model": "n0tune/dev",
  "max_context_tokens": 1200
}
```

`n0tune/dev` is a local development provider. Configure an OpenAI-compatible provider with:

- `N0TUNE_PROVIDER_BASE_URL`
- `N0TUNE_PROVIDER_API_KEY`

## Cache

```http
GET /v1/cache?app_id=demo&user_id=user_123
DELETE /v1/cache?app_id=demo&user_id=user_123
GET /v1/context-runs?app_id=demo&user_id=user_123
```

Cache entries track:

- input hash
- input embedding
- answer
- model
- context hash
- memory/document/style dependencies
- TTL

## OpenAI-Compatible Proxy

```http
POST /v1/openai/chat/completions
```

Headers:

```text
X-N0Tune-App-ID: demo
X-N0Tune-User-ID: user_123
Authorization: Bearer replace-with-local-development-key
```

### Streaming

Set `"stream": true` to receive a Server-Sent Events stream of `chat.completion.chunk` deltas. The final event is `data: [DONE]`. The `finish_reason: "stop"` chunk also carries a `n0tune` object with `cache_hit`, `tokens_saved_estimated`, `prompt_tokens_estimated`, and `provider`. Streaming works for both live provider answers and semantic-cache hits.

The current implementation resolves the full answer server-side and then fans the text out into deltas; latency-true pass-through from an upstream streaming provider is a future improvement.

## Authentication

For the MVP, auth is optional unless a key is supplied or `N0TUNE_REQUIRE_API_KEY=true`. When auth is enabled, N0Tune hashes app API keys and compares the hash. Never store plaintext production keys.

## Rate limiting

All `/v1/*` requests run through a configurable rate-limit middleware.

- `N0TUNE_RATE_LIMIT_RPM` — requests per window per caller. `0` (default) disables rate limiting.
- `N0TUNE_RATE_LIMIT_WINDOW_SECONDS` — window size in seconds (default `60`).
- `N0TUNE_RATE_LIMIT_BACKEND` — `memory` (default, single-process) or `redis` (multi-replica safe, uses `N0TUNE_REDIS_URL`).

The caller key is derived from, in order: `Authorization: Bearer <token>`, `X-N0Tune-API-Key`, the first IP in `X-Forwarded-For`, then the socket peer. When the limit is exceeded the response is `429 Too Many Requests` with a `Retry-After` header and JSON body `{"error": "rate_limited", "retry_after": <seconds>}`. Routes outside `/v1/*` (notably `/health`) are not rate-limited.
