# Scaling

What to do when traffic grows. Pre-1.0 advice: stay simple, scale Postgres
and the API first, leave everything else alone until measurements force you.

## Layer-by-layer

### API service

- **Stateless.** Any replica can serve any request. Scale on CPU; memory is
  modest because the API doesn't hold long-running state.
- **Replicas.** 2 is the minimum for redundancy. Push to 4–8 before
  reaching for fancier patterns.
- **Rate limiting** must use the Redis backend when replicas > 1.
  `N0TUNE_RATE_LIMIT_BACKEND=redis`. The in-memory limiter is per-pod and
  multi-replica configurations would let callers exceed their RPM by the
  number of replicas.
- **Embedding latency** dominates `/v1/context/preview` when using
  `fastembed`. Move embedding to a separate microservice once the API's
  P99 is dominated by `embed_text`.

### Postgres

- **Vertical first.** Go from a 2-vCPU / 4GB instance to a 4-vCPU / 16GB
  before reading anything below.
- **pgvector index.** As the `memories` table crosses ~100k rows, an
  HNSW index on `embedding` becomes worth it:

  ```sql
  CREATE INDEX CONCURRENTLY memories_embedding_hnsw_idx
    ON memories USING hnsw (embedding vector_cosine_ops);
  ```
  Same shape for `document_chunks`. Pre-create the indexes off-peak — HNSW
  builds aren't free.
- **Read replicas.** For analytics on `context_runs` and `audit_logs`, run
  a read replica and pipe heavy queries there. The API doesn't need read
  replicas yet because retrieval queries are small.
- **Connection pooling.** Run PgBouncer in transaction mode in front of
  Postgres once you exceed ~80 concurrent API pods.
- **Sharding.** Post-1.0. The schema is shard-friendly (everything keyed
  by `app_id`), but we don't ship the routing layer yet.

### Redis

- One primary with AOF persistence handles cache + rate limit comfortably
  through tens of thousands of QPM.
- Use Redis Sentinel or a managed service (ElastiCache, Memorystore,
  Upstash) for HA. The cache is rebuildable; the rate limit isn't, but
  losing the limiter briefly is a graceful failure (worst case: more
  upstream calls).
- Don't pin the cache and the limiter to separate Redis databases unless
  you actually need to. They share the same instance fine.

### LLM provider

- The provider is almost always the slow path. Cache hits avoid it; that's
  where the semantic cache earns its keep.
- If you're calling OpenAI / Anthropic / Bedrock directly, watch their per-
  model RPM and TPM. The N0Tune rate limiter caps callers; you also need
  to cap the provider side so a noisy app doesn't burn your provider
  quota.

### Dashboard

- Stateless Next.js. Scale on CPU. Cache the `/health?deep=true` response
  for ~5s at the edge if you have heavy dashboard traffic.

## When to add caching layers

The semantic cache is on by default. Two questions you'll ask in production:

1. **Why is my hit rate low?** Likely the cache similarity threshold is
   too strict, or the `context_hash` changes too often (e.g. you're
   modifying memories on every request). Lower
   `N0TUNE_CACHE_SIMILARITY_THRESHOLD` or stabilize the context shape.
2. **Why is my cache poisoning hits I don't want?** Raise the threshold,
   shorten `N0TUNE_DEFAULT_CACHE_TTL_SECONDS`, or invalidate explicitly via
   `DELETE /v1/cache`.

## What scaling does **not** mean

- It doesn't mean "add a queue." N0Tune is synchronous on purpose. The
  context compiler is fast (<100ms typical). If you need async, wrap the
  whole thing in your application layer.
- It doesn't mean "shard everything." Even at moderate scale, a single
  beefy Postgres serves the workload comfortably. Shard only when
  measurement says so.
- It doesn't mean "rewrite in Rust." The bottleneck is almost never the
  Python service.

## Capacity math you can do today

- Each `/v1/chat` call: ~1–3 short Postgres queries + 1 Redis lookup + 1
  embedding (≤ 50ms with fastembed locally, ≤ 200ms with hosted) + 1
  provider call (variable). N0Tune adds roughly 50–250ms before the
  provider.
- Per-pod throughput: 50–100 concurrent `/v1/chat` calls before the event
  loop saturates. Add pods until your provider throttles you, then stop.
- Semantic cache: a fresh chat answer is 1–2 KB of `answer` + a 384-dim
  embedding (~3 KB serialized). 100k cache entries ≈ 500 MB. Redis with
  4 GB is plenty.

## What this is **not**

- Not a sizing guide for your specific traffic. Measure, don't trust this
  doc.
- Not a microservice playbook. N0Tune is intentionally one service plus a
  dashboard plus connectors. If you split it, you own that complexity.
- Not a substitute for [`observability.md`](observability.md). You can't
  scale what you don't measure.
