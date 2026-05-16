# Observability

N0Tune ships with optional [Langfuse](https://langfuse.com) tracing. When
configured, every `POST /v1/chat` and `POST /v1/context/preview` records a
trace event with the request metadata, the selected memory/chunk ids, cache
hit status, and token-saving estimates. When not configured, the integration
is a no-op — there is no Langfuse-shaped dependency on the request path.

## Enabling

1. Install the optional dependency:

   ```bash
   pip install -e "apps/api[langfuse]"
   ```

2. Set the two keys (host defaults to Langfuse Cloud):

   ```bash
   export N0TUNE_LANGFUSE_PUBLIC_KEY=pk_...
   export N0TUNE_LANGFUSE_SECRET_KEY=sk_...
   # Optional override for self-hosted Langfuse:
   export N0TUNE_LANGFUSE_HOST=https://langfuse.example.com
   ```

3. Restart the API. New chats and context previews show up in your Langfuse
   project.

## Trace shape

Each event sends `name` plus a `metadata` dict.

`chat`:

```json
{
  "app_id": "demo",
  "user_id": "user_1",
  "request_id": "...",
  "model": "n0tune/dev",
  "provider": "n0tune/dev",
  "cache_hit": false,
  "prompt_tokens_estimated": 920,
  "tokens_saved_estimated": 4200,
  "memory_ids": ["mem_abc", "mem_def"],
  "chunk_ids": ["chk_xyz"],
  "warnings": []
}
```

`context.preview`:

```json
{
  "app_id": "demo",
  "user_id": "user_1",
  "request_id": "...",
  "model": "n0tune/dev",
  "prompt_tokens_estimated": 920,
  "tokens_saved_estimated": 4200,
  "memory_ids": ["mem_abc"],
  "chunk_ids": ["chk_xyz"],
  "warnings": []
}
```

The point of this integration is the same as the dashboard's Context Preview
tab: make every request inspectable so you can answer "what did the compiler
do, and was it worth it?" without instrumenting your own app.

## Fail-open guarantees

The integration is implemented in
[`services/observability/langfuse.py`](../apps/api/app/services/observability/langfuse.py).
Three guardrails:

- Missing `langfuse` package → the integration is a no-op and a single info
  log line at startup. No exceptions.
- Missing keys → no client is created and no calls are made.
- A trace call raising inside Langfuse → the exception is caught and logged at
  debug; the request continues.

The intent is that you can enable observability in any environment without
risking a regression in chat availability.

## Other observability hooks

- Structured logs include the `X-Request-ID` for every request, set by the
  request-id middleware and echoed in the response.
- The `context_runs` table persists what the compiler chose for every
  `/v1/chat` and `/v1/context/preview`. See
  [`docs/context-compiler.md`](context-compiler.md). This is the local fallback
  when Langfuse is disabled.

If you want OpenTelemetry exporters or a different tracing system, the
`record_observation` function is small and easy to swap or extend.
