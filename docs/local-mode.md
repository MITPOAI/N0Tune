# Local / offline mode

N0Tune runs fully on a laptop. No SaaS dependency is required: model
inference can target Ollama or any other OpenAI-compatible local server, and
embeddings can run in-process via `fastembed`.

## What "local mode" means

Three pieces have to go local:

1. **The LLM provider.** Point `N0TUNE_PROVIDER_BASE_URL` at an
   OpenAI-compatible local server (Ollama, LM Studio, vLLM, llama-server).
2. **The embedding provider.** Set `N0TUNE_EMBEDDING_PROVIDER=fastembed` to
   run sentence-transformers in-process, or `=hash` to keep the
   deterministic dev backend.
3. **Optional integrations** (MCP, observability). The MCP server is
   localhost-only by default. Langfuse is opt-in and can target a
   self-hosted Langfuse instance via `N0TUNE_LANGFUSE_HOST`.

Postgres, Redis, and the dashboard already run locally via Docker Compose.

## Ollama path

Run Ollama on the host (not inside the Compose network — that complicates
GPU passthrough). Point N0Tune at its OpenAI-compatible endpoint:

```bash
# 1. Pull a model
ollama pull llama3.1:8b-instruct

# 2. Confirm the OpenAI-compatible endpoint works
curl http://localhost:11434/v1/models

# 3. Tell N0Tune to use it
export N0TUNE_PROVIDER_NAME="llama3.1:8b-instruct"
export N0TUNE_PROVIDER_BASE_URL="http://host.docker.internal:11434/v1"
export N0TUNE_PROVIDER_API_KEY="ollama"   # any non-empty string

# 4. Boot the stack
docker compose up -d --wait
```

On Linux, replace `host.docker.internal` with `host.docker.internal:host-gateway`
in your Compose `extra_hosts` for the API service, or just use the host's
IP directly.

For a self-contained example see
[`examples/local-ollama/`](../examples/local-ollama/).

## Local embeddings (fastembed)

```bash
pip install -e "apps/api[fastembed]"
export N0TUNE_EMBEDDING_PROVIDER=fastembed
export N0TUNE_FASTEMBED_MODEL=BAAI/bge-small-en-v1.5
```

The first call downloads the model (~33 MB) into `~/.cache/fastembed/`. The
default model is 384-dim, which matches the schema's `Vector(384)`.

If `fastembed` ever fails (e.g. you set `N0TUNE_FASTEMBED_MODEL` to a
non-existent model), N0Tune falls back to the deterministic hash backend
and logs a warning. The request keeps serving.

## LM Studio / vLLM / llama-server

Any local server that ships an OpenAI-compatible `/chat/completions`
endpoint works the same way: set `N0TUNE_PROVIDER_BASE_URL` to its base URL.

- LM Studio: `http://localhost:1234/v1`
- vLLM: `http://localhost:8000/v1` (collides with N0Tune's default; change
  the port on one side)
- llama-server: `http://localhost:8080/v1`

## What stays remote (and how to disable it)

- **Provider API calls.** Once `N0TUNE_PROVIDER_BASE_URL` points at
  `localhost` (or `host.docker.internal`), no provider traffic leaves
  your machine. Confirm by running with the network off.
- **Embedding model download.** `fastembed` downloads the model the first
  time it runs. After that, it's offline. If you need pre-seeded models
  (air-gapped deployments), copy `~/.cache/fastembed/` to the target host.
- **Telemetry.** N0Tune ships no telemetry. Langfuse is opt-in and disabled
  by default.
- **MCP.** The MCP stdio server runs locally and is invoked by Claude
  Desktop / Claude Code over stdio — there is no network listener.

## What this is **not**

- Not a GPU scheduler. If you want N0Tune-driven workload scheduling
  across multiple local GPUs, use vLLM / Ray Serve in front of Ollama and
  point `N0TUNE_PROVIDER_BASE_URL` at it.
- Not a model installer. We don't bundle weights; pull them with
  `ollama pull`, `huggingface-cli download`, or whichever tool you use.
- Not a benchmark. See [benchmarks.md](benchmarks.md) for token-savings
  numbers; local-mode latency is dominated by the model you choose, not by
  N0Tune.

## Smoke test

```bash
# With Ollama running on the host:
docker compose up -d --wait
pwsh scripts/smoke-mvp.ps1
```

The smoke script doesn't care whether the provider is OpenAI, Ollama, or
the built-in `n0tune/dev` mock — it asserts the API surface, not the
model output.
