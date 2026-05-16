# Local Ollama example

Run the full N0Tune stack against [Ollama](https://ollama.com/) on the host —
no cloud provider keys, no telemetry, no network egress for inference.

## Prerequisites

- Ollama installed and running on the host (`ollama serve` or the desktop app).
- One pulled model. `llama3.1:8b-instruct` is a sensible default if you have
  a recent GPU or 32 GB RAM; `llama3.2:3b-instruct` is the lighter option.
- Docker Compose v2 (`docker compose --version`).

## One-time setup

```bash
ollama pull llama3.1:8b-instruct

# Sanity check the OpenAI-compatible endpoint
curl -s http://localhost:11434/v1/models | jq '.data[].id'
```

## Run

From the repo root:

```bash
cp .env.example .env
cat >> .env <<'EOF'

# Local Ollama provider
N0TUNE_PROVIDER_NAME=llama3.1:8b-instruct
N0TUNE_PROVIDER_BASE_URL=http://host.docker.internal:11434/v1
N0TUNE_PROVIDER_API_KEY=ollama

# Local embeddings (optional but recommended for real semantic recall)
N0TUNE_EMBEDDING_PROVIDER=fastembed
N0TUNE_FASTEMBED_MODEL=BAAI/bge-small-en-v1.5
EOF

docker compose up -d --wait
```

> **Linux only:** the API container needs to reach the host. Add an
> `extra_hosts` entry for the `api` service in a Compose override:
>
> ```yaml
> # docker-compose.override.yml
> services:
>   api:
>     extra_hosts:
>       - "host.docker.internal:host-gateway"
> ```
>
> Mac and Windows users get this for free.

## Smoke

```bash
curl -s http://localhost:8000/health | jq
pwsh scripts/smoke-mvp.ps1
```

The smoke script doesn't depend on the provider being Ollama; it asserts
the API surface. If it passes, the stack is working.

## Try the personalized chat

```bash
# Seed a memory
curl -s -X POST http://localhost:8000/v1/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace-with-local-development-key" \
  -d '{
        "app_id": "demo",
        "user_id": "alice",
        "type": "preference",
        "text": "Prefers terse, code-first answers without analogies.",
        "confidence": 0.95
      }' | jq

# Ask a question; Ollama generates the answer using the compiled context
curl -s -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace-with-local-development-key" \
  -d '{
        "app_id": "demo",
        "user_id": "alice",
        "message": "Explain how retrieval-augmented generation works."
      }' | jq
```

The response includes the generated answer plus the `context` block showing
which memories and chunks the compiler selected and the estimated token
savings vs. a naive baseline.

## Tear down

```bash
docker compose down -v
```

`-v` removes the Postgres and Redis volumes. Drop it if you want to keep
your memories and documents for the next run.

## Troubleshooting

- **`Connection refused` from the API container.** On Linux, add the
  `host.docker.internal` extra-host shown above. On Windows / Mac, confirm
  Ollama is actually listening on `11434`.
- **fastembed download fails behind a proxy.** Set `HTTPS_PROXY` in `.env`
  or pre-populate `~/.cache/fastembed/` from another machine.
- **Slow first response.** Ollama loads the model on the first request.
  Subsequent calls are warm.

## What this is **not**

- Not a benchmark. Latency depends on your GPU. See
  [docs/local-mode.md](../../docs/local-mode.md) for the broader story.
- Not a GPU scheduler. Run vLLM in front of Ollama if you need that.
- Not a model installer. Pull models with `ollama pull`; we don't bundle
  weights.
