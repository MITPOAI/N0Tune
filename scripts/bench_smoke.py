"""Quick gateway benchmark — hits /health and /v1/context/preview.

Reports p50/p95/p99 latency, throughput, and error rate per endpoint.
No external deps beyond the stdlib (uses httpx via threadpool would be
better, but the stack is local so this is fine).
"""

from __future__ import annotations

import concurrent.futures as cf
import json
import statistics
import time
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * p
    f = int(k)
    c = min(f + 1, len(values) - 1)
    return values[f] + (values[c] - values[f]) * (k - f)


def hit(method: str, path: str, body: dict | None = None) -> tuple[float, int]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception:
        status = 0
    return (time.perf_counter() - t0) * 1000.0, status


def run(label: str, method: str, path: str, body: dict | None, n: int, c: int) -> dict:
    lats: list[float] = []
    statuses: list[int] = []
    started = time.perf_counter()
    with cf.ThreadPoolExecutor(max_workers=c) as ex:
        futs = [ex.submit(hit, method, path, body) for _ in range(n)]
        for f in cf.as_completed(futs):
            lat, st = f.result()
            lats.append(lat)
            statuses.append(st)
    elapsed = time.perf_counter() - started
    ok = sum(1 for s in statuses if 200 <= s < 300)
    return {
        "label": label,
        "requests": n,
        "concurrency": c,
        "elapsed_s": round(elapsed, 3),
        "rps": round(n / elapsed, 1),
        "ok": ok,
        "errors": n - ok,
        "p50_ms": round(_percentile(lats, 0.50), 2),
        "p95_ms": round(_percentile(lats, 0.95), 2),
        "p99_ms": round(_percentile(lats, 0.99), 2),
        "mean_ms": round(statistics.fmean(lats), 2),
        "max_ms": round(max(lats), 2),
    }


def main() -> None:
    cases = [
        ("GET /health (cold)", "GET", "/health", None, 200, 1),
        ("GET /health (c=16)", "GET", "/health", None, 1000, 16),
        ("GET /health (c=64)", "GET", "/health", None, 2000, 64),
        ("POST /v1/alignment/check (c=8)", "POST", "/v1/alignment/check",
         {"text": "Please summarize today's release notes."}, 200, 8),
        ("POST /v1/context/preview (c=4)", "POST", "/v1/context/preview",
         {"user_id": "bench-user", "message": "Summarize the latest release.",
          "max_context_tokens": 1500}, 100, 4),
        ("POST /v1/context/preview (c=16)", "POST", "/v1/context/preview",
         {"user_id": "bench-user", "message": "Summarize the latest release.",
          "max_context_tokens": 1500}, 200, 16),
    ]

    print(f"{'label':40s} {'n':>5} {'c':>4} {'rps':>8} "
          f"{'p50':>8} {'p95':>8} {'p99':>8} {'mean':>8} {'errs':>5}")
    for label, method, path, body, n, c in cases:
        r = run(label, method, path, body, n, c)
        print(f"{r['label']:40s} {r['requests']:>5} {r['concurrency']:>4} "
              f"{r['rps']:>8} {r['p50_ms']:>8} {r['p95_ms']:>8} "
              f"{r['p99_ms']:>8} {r['mean_ms']:>8} {r['errors']:>5}")


if __name__ == "__main__":
    main()
