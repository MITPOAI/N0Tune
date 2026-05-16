"use client";

import { useEffect, useMemo, useState } from "react";

import { apiBaseUrl } from "../lib/config";

type HealthResponse = {
  status: "ok";
  service: "n0tune-api";
  version: string;
  phase: "0";
  request_id: string;
  dependencies: {
    database: "not_checked";
    redis: "not_checked";
  };
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; health: HealthResponse }
  | { kind: "error"; message: string };

export function ServiceStatus() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const healthUrl = useMemo(() => `${apiBaseUrl.replace(/\/$/, "")}/health`, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      try {
        const response = await fetch(healthUrl, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "X-Request-ID": "n0tune-dashboard-phase0",
          },
        });

        if (!response.ok) {
          throw new Error(`Health check failed with HTTP ${response.status}`);
        }

        const health = (await response.json()) as HealthResponse;
        setState({ kind: "ready", health });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Unknown health check error",
        });
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, [healthUrl]);

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Local service status</h2>
          <p className="mt-1 text-sm text-ink/60">{healthUrl}</p>
        </div>
        <StatusPill state={state.kind} />
      </div>

      <div className="mt-5 grid gap-3">
        {state.kind === "loading" ? (
          <StatusRow label="API health" value="Checking" />
        ) : state.kind === "error" ? (
          <StatusRow label="API health" value={state.message} tone="error" />
        ) : (
          <>
            <StatusRow label="API health" value={state.health.status} tone="ready" />
            <StatusRow label="API version" value={state.health.version} />
            <StatusRow label="Phase" value={state.health.phase} />
            <StatusRow label="Database" value={state.health.dependencies.database} />
            <StatusRow label="Redis" value={state.health.dependencies.redis} />
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ state }: { state: LoadState["kind"] }) {
  const classes =
    state === "ready"
      ? "border-moss/30 bg-moss/10 text-moss"
      : state === "error"
        ? "border-rust/30 bg-rust/10 text-rust"
        : "border-line bg-field text-ink/60";

  const label = state === "ready" ? "Online" : state === "error" ? "Check API" : "Loading";

  return <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ready" | "error";
}) {
  const valueClass =
    tone === "ready" ? "text-moss" : tone === "error" ? "text-rust" : "text-ink/78";

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line pt-3 text-sm">
      <span className="text-ink/56">{label}</span>
      <span className={`text-right font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
