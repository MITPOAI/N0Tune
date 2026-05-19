import { useCallback, useEffect, useState } from "react";
import {
  type ExtensionConfig,
  defaultConfig,
  loadConfig,
  saveConfig,
} from "../lib/config";
import { healthcheck } from "../lib/gateway";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; latency_ms: number }
  | { kind: "error"; message: string };

/**
 * Popup UI — the config surface for the extension.
 *
 * Three controls: on/off toggle, Gateway URL, user_id. A "Test
 * connection" button verifies the Gateway is reachable and returns
 * health. Config persists in chrome.storage.local; the background
 * worker reads the same key when the content script asks it to
 * compile context.
 *
 * Content scripts are scaffolded but the actual DOM injection on
 * claude.ai and chat.openai.com is week-2 work — see
 * apps/extension/src/content/index.ts for the placeholder.
 */
export function Popup() {
  const [config, setConfig] = useState<ExtensionConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadConfig().then((c) => {
      setConfig(c);
      setLoaded(true);
    });
  }, []);

  const onSave = useCallback(async () => {
    await saveConfig(config);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }, [config]);

  const onTest = useCallback(async () => {
    setStatus({ kind: "checking" });
    const t0 = performance.now();
    try {
      await healthcheck(config.gatewayUrl);
      setStatus({
        kind: "ok",
        latency_ms: Math.round(performance.now() - t0),
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }, [config.gatewayUrl]);

  if (!loaded) {
    return <p style={mute}>Loading…</p>;
  }

  return (
    <div>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src="icon.png"
          alt=""
          width={28}
          height={28}
          style={{ display: "block", borderRadius: 6 }}
        />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <strong style={{ fontSize: 14 }}>N0Tune</strong>
          <span style={mute}>v0.1.5 · scaffold</span>
        </div>
        <span style={{ flex: 1 }} />
        <label style={{ ...row, gap: 6 }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
          />
          <span style={{ fontSize: 13 }}>
            {config.enabled ? "On" : "Off"}
          </span>
        </label>
      </header>

      <p style={{ ...mute, marginTop: 4 }}>
        Injects N0Tune context into Claude and ChatGPT web UIs.
      </p>

      <label style={field}>
        <span style={labelStyle}>Gateway URL</span>
        <input
          style={input}
          value={config.gatewayUrl}
          onChange={(e) =>
            setConfig({ ...config, gatewayUrl: e.target.value })
          }
          placeholder="http://localhost:8000"
          spellCheck={false}
        />
      </label>

      <label style={field}>
        <span style={labelStyle}>user_id</span>
        <input
          style={input}
          value={config.userId}
          onChange={(e) =>
            setConfig({ ...config, userId: e.target.value })
          }
          placeholder="n0tune_builder"
          spellCheck={false}
        />
      </label>

      <label style={field}>
        <span style={labelStyle}>app_id</span>
        <input
          style={input}
          value={config.appId}
          onChange={(e) =>
            setConfig({ ...config, appId: e.target.value })
          }
          placeholder="demo"
          spellCheck={false}
        />
      </label>

      <label style={field}>
        <span style={labelStyle}>API key</span>
        <input
          style={input}
          value={config.apiKey}
          onChange={(e) =>
            setConfig({ ...config, apiKey: e.target.value })
          }
          placeholder="leave blank if Gateway has REQUIRE_API_KEY=false"
          type="password"
          spellCheck={false}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={primaryBtn} onClick={onSave}>
          {saved ? "Saved ✓" : "Save"}
        </button>
        <button style={secondaryBtn} onClick={onTest}>
          Test connection
        </button>
      </div>

      <StatusLine status={status} />

      <footer style={{ marginTop: 14 }}>
        <p style={{ ...mute, fontSize: 11 }}>
          DOM injection on claude.ai and chat.openai.com is scaffolded
          but disabled in v0.1.5. See{" "}
          <a
            href="https://github.com/MITPOAI/N0Tune"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)" }}
          >
            project README
          </a>{" "}
          for the v0.2 roadmap.
        </p>
      </footer>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  if (status.kind === "checking") {
    return <p style={{ ...mute, marginTop: 10 }}>Checking…</p>;
  }
  if (status.kind === "ok") {
    return (
      <p
        style={{
          ...mute,
          marginTop: 10,
          color: "var(--accent)",
        }}
      >
        Gateway ok · {status.latency_ms} ms
      </p>
    );
  }
  return (
    <p
      style={{
        ...mute,
        marginTop: 10,
        color: "var(--warn)",
      }}
    >
      {status.message}
    </p>
  );
}

const row = { display: "flex", alignItems: "center" } as const;
const mute = { color: "var(--ink-mute)", fontSize: 12, margin: 0 } as const;
const field = {
  display: "block",
  marginTop: 10,
} as const;
const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: 0.3,
  color: "var(--ink-mute)",
  display: "block",
  marginBottom: 4,
};
const input = {
  width: "100%",
  border: "1px solid var(--line)",
  background: "var(--field)",
  color: "var(--ink)",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};
const primaryBtn = {
  flex: 1,
  background: "var(--ink)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const secondaryBtn = {
  flex: 1,
  background: "var(--field)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
