# Kubernetes deployment

This guide is a starting point, not a turnkey production deployment. It shows
the shape of a sensible N0Tune install on Kubernetes; you should adapt it to
your cluster, ingress controller, secrets manager, and observability stack.

The local Docker Compose stack ([docker-compose.yml](../docker-compose.yml)) is
the source of truth for which services need to run together: Postgres with
pgvector, Redis, the API (`apps/api`), and the dashboard (`apps/dashboard`).

## Data plane

### Postgres with pgvector

Run Postgres via a managed operator rather than a bare StatefulSet. Recommended
choices, both production-tested with pgvector:

- [CloudNativePG](https://cloudnative-pg.io/) — pure Kubernetes operator, has a
  first-class extension API and good backup/restore via Barman.
- [Zalando Postgres Operator](https://github.com/zalando/postgres-operator) —
  mature, used widely; pgvector is available via custom image build.

The N0Tune schema needs the `vector` extension. Apply it once before running
Alembic migrations:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Redis

Use a single primary with persistence (RDB + AOF) for the dev/staging stack and
Redis Sentinel or a managed Redis (ElastiCache, Memorystore, Upstash) for
production. The semantic cache and rate-limiter are both happy with a single
logical Redis instance.

## API service

Minimal `Deployment` + `Service`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n0tune-api
spec:
  replicas: 2
  selector:
    matchLabels: { app: n0tune-api }
  template:
    metadata:
      labels: { app: n0tune-api }
    spec:
      containers:
        - name: api
          image: ghcr.io/your-org/n0tune-api:0.1.0
          ports: [{ containerPort: 8000 }]
          env:
            - { name: N0TUNE_ENVIRONMENT, value: production }
            - { name: N0TUNE_API_HOST, value: 0.0.0.0 }
            - { name: N0TUNE_REQUIRE_API_KEY, value: "true" }
            - { name: N0TUNE_RATE_LIMIT_RPM, value: "120" }
            - { name: N0TUNE_RATE_LIMIT_BACKEND, value: redis }
          envFrom:
            - secretRef: { name: n0tune-api-secrets }
          readinessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests: { cpu: 200m, memory: 256Mi }
            limits:   { cpu: 1,    memory: 1Gi }
---
apiVersion: v1
kind: Service
metadata: { name: n0tune-api }
spec:
  selector: { app: n0tune-api }
  ports: [{ port: 80, targetPort: 8000 }]
```

The two replicas mean rate-limiting must use the Redis backend
(`N0TUNE_RATE_LIMIT_BACKEND=redis`) so counters are shared.

## Dashboard service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: n0tune-dashboard }
spec:
  replicas: 2
  selector: { matchLabels: { app: n0tune-dashboard } }
  template:
    metadata: { labels: { app: n0tune-dashboard } }
    spec:
      containers:
        - name: dashboard
          image: ghcr.io/your-org/n0tune-dashboard:0.1.0
          ports: [{ containerPort: 3000 }]
          env:
            - { name: NEXT_PUBLIC_N0TUNE_API_BASE_URL, value: https://api.n0tune.example.com }
          readinessProbe:
            httpGet: { path: /, port: 3000 }
            periodSeconds: 10
          resources:
            requests: { cpu: 100m, memory: 192Mi }
            limits:   { cpu: 500m, memory: 512Mi }
---
apiVersion: v1
kind: Service
metadata: { name: n0tune-dashboard }
spec:
  selector: { app: n0tune-dashboard }
  ports: [{ port: 80, targetPort: 3000 }]
```

## Ingress

Use whatever ingress controller you already run. Example with `ingress-nginx`
and `cert-manager`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: n0tune
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.n0tune.example.com, app.n0tune.example.com]
      secretName: n0tune-tls
  rules:
    - host: api.n0tune.example.com
      http:
        paths:
          - { path: /, pathType: Prefix, backend: { service: { name: n0tune-api, port: { number: 80 } } } }
    - host: app.n0tune.example.com
      http:
        paths:
          - { path: /, pathType: Prefix, backend: { service: { name: n0tune-dashboard, port: { number: 80 } } } }
```

Streaming responses (`POST /v1/openai/chat/completions` with `stream: true`)
require the ingress to disable response buffering. For ingress-nginx, add the
annotation `nginx.ingress.kubernetes.io/proxy-buffering: "off"`.

## Secrets

Do not bake secrets into images or commit them. Use
[External Secrets Operator](https://external-secrets.io/) and synchronize from
your real secret store (AWS Secrets Manager, GCP Secret Manager, Vault, etc.):

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: { name: n0tune-api-secrets }
spec:
  refreshInterval: 1h
  secretStoreRef: { name: cluster-secret-store, kind: ClusterSecretStore }
  target: { name: n0tune-api-secrets }
  data:
    - { secretKey: N0TUNE_DATABASE_URL,        remoteRef: { key: n0tune/database-url } }
    - { secretKey: N0TUNE_REDIS_URL,           remoteRef: { key: n0tune/redis-url } }
    - { secretKey: N0TUNE_APP_API_KEY,         remoteRef: { key: n0tune/app-api-key } }
    - { secretKey: N0TUNE_PROVIDER_API_KEY,    remoteRef: { key: n0tune/provider-api-key } }
    - { secretKey: N0TUNE_EMBEDDING_OPENAI_API_KEY, remoteRef: { key: n0tune/openai-api-key } }
```

## Migrations

Alembic should run as a one-shot `Job` before the API rolls out. Reuse the API
image:

```yaml
apiVersion: batch/v1
kind: Job
metadata: { name: n0tune-migrate-0-1-0 }
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: ghcr.io/your-org/n0tune-api:0.1.0
          command: ["alembic", "upgrade", "head"]
          envFrom: [{ secretRef: { name: n0tune-api-secrets } }]
```

In CI, gate the API deploy on the migration job succeeding.

## Production checklist

Before pointing real users at the install:

- [ ] Postgres has `vector` extension installed; backups verified by a test restore.
- [ ] Redis has persistence enabled; failover plan tested if production.
- [ ] `N0TUNE_REQUIRE_API_KEY=true` and each app has a hashed key.
- [ ] `N0TUNE_RATE_LIMIT_RPM` set; backend is `redis` when replicas > 1.
- [ ] Streaming verified through the ingress (try `curl -N` against `/v1/openai/chat/completions`).
- [ ] Secrets come from External Secrets, not literal `Secret` manifests.
- [ ] Ingress has TLS, HSTS, and a sane request size limit (e.g. 10MiB).
- [ ] Provider configured (`N0TUNE_PROVIDER_*`) and the real-provider integration test in CI is green.
- [ ] Embedding provider configured (`N0TUNE_EMBEDDING_PROVIDER=openai|fastembed`) — the default `hash` backend is dev-only.
- [ ] Migrations have run (`alembic upgrade head`) and the API readiness probe is green.
- [ ] Observability: structured logs scraped; if used, Langfuse keys set (see [observability.md](observability.md)).
- [ ] Document retention and memory-deletion controls reviewed by your privacy/legal team.

## A Helm chart?

Not yet shipped. The shape above is small enough that templating it is mostly
cosmetic, but a chart is a reasonable PR if someone wants to contribute one —
keep it close to these manifests so the documentation continues to match.
