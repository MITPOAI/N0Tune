import { useCallback, useEffect, useState } from "react";

import { RoomShell } from "./RoomShell";

interface AlignmentRule {
  id: string;
  rule_type: string;
  title: string;
  severity: string;
  active: boolean;
}

interface AlignmentIssue {
  type: string;
  severity: string;
  finding: string;
  evidence: string;
  recommendation: string;
}

interface AlignmentReport {
  aligned: boolean;
  risk_level: string;
  summary: string;
  issues: AlignmentIssue[];
}

/**
 * Guard — Context Guard surface inside the Desktop. Talks to a
 * locally-running Gateway if one is reachable on `localhost:8000`;
 * otherwise shows a calm "not connected" state with a one-line
 * pointer to the install doc. Never blocks the Desktop on the
 * Gateway being up — Context Guard is an *optional* layer.
 *
 * When connected, the room shows:
 *   - The active rule list (read-only — admin actions stay in the
 *     dashboard / CLI).
 *   - A "Check a claim" textarea that POSTs /v1/alignment/check and
 *     renders the structured report (severity, evidence,
 *     recommendation, blocked actions).
 */
const GATEWAY_URL = "http://localhost:8000";

export function GuardRoom() {
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [rules, setRules] = useState<AlignmentRule[]>([]);
  const [claim, setClaim] = useState("");
  const [report, setReport] = useState<AlignmentReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const health = await fetch(`${GATEWAY_URL}/health`, {
        method: "GET",
        cache: "no-store",
      });
      if (!health.ok) {
        setReachable(false);
        return;
      }
      setReachable(true);
      const ruleList = await fetch(
        `${GATEWAY_URL}/v1/alignment/rules?app_id=demo`,
      );
      if (ruleList.ok) {
        const rows = (await ruleList.json()) as AlignmentRule[];
        setRules(rows.filter((r) => r.active));
      }
    } catch {
      setReachable(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCheck = useCallback(async () => {
    if (!claim.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`${GATEWAY_URL}/v1/alignment/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: "demo",
          user_id: "desktop",
          content: claim,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as AlignmentReport;
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, [claim]);

  return (
    <RoomShell
      icon="⚖"
      title="Guard"
      subtitle={
        reachable === null
          ? "Checking the Gateway…"
          : reachable
            ? `${rules.length} alignment ${
                rules.length === 1 ? "rule" : "rules"
              } loaded`
            : "Gateway not reachable — Context Guard runs server-side"
      }
      actions={
        reachable ? (
          <button type="button" className="link" onClick={() => void refresh()}>
            Refresh rules
          </button>
        ) : null
      }
    >
      {reachable ? (
        <div className="guard-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Active rules</h2>
              <span className="chip">{rules.length}</span>
            </div>
            {rules.length === 0 ? (
              <p className="empty">
                No rules yet. Seed the starter set with{" "}
                <code>python scripts/seed-alignment-rules.py</code>.
              </p>
            ) : (
              <ul className="memory-list">
                {rules.map((rule) => (
                  <li key={rule.id} className="memory-row">
                    <div>
                      <span className={`chip chip--${severityChipClass(rule.severity)}`}>
                        {rule.severity}
                      </span>{" "}
                      <strong>{rule.title}</strong>
                      <p className="small muted">{rule.rule_type}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Check a claim</h2>
            </div>
            <textarea
              className="memory-add input"
              rows={3}
              placeholder="e.g. 'N0Tune fine-tunes Claude through memory.'"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="primary"
                disabled={checking || !claim.trim()}
                onClick={() => void handleCheck()}
              >
                {checking ? "Checking…" : "Run alignment check"}
              </button>
              {report ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setReport(null);
                    setClaim("");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {error ? <p className="warnings">{error}</p> : null}
            {report ? <GuardReport report={report} /> : null}
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h2>Context Guard is offline</h2>
          </div>
          <p className="muted small">
            Guard checks AI outputs against your stored rules (terminology,
            phase scope, security patterns, benchmark facts, secret detection).
            It runs in the N0Tune Gateway. Start the Gateway with{" "}
            <code>docker compose up -d --wait</code> from the repo root and
            click <strong>Refresh rules</strong>.
          </p>
          <button type="button" className="primary" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
    </RoomShell>
  );
}

function severityChipClass(severity: string): string {
  switch (severity) {
    case "critical":
    case "high":
      return "warn";
    default:
      return "neutral";
  }
}

function GuardReport({ report }: { report: AlignmentReport }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        className={`notice ${
          report.aligned ? "" : "notice--warn"
        }`}
        style={{ margin: 0 }}
      >
        <span>
          <strong>
            {report.aligned ? "Aligned" : "Not aligned"} · risk {report.risk_level}
          </strong>{" "}
          — {report.summary}
        </span>
      </div>
      {report.issues.length > 0 ? (
        <ul className="memory-list" style={{ marginTop: 12 }}>
          {report.issues.map((issue, index) => (
            <li
              key={`${issue.type}-${index}`}
              className="memory-row"
            >
              <div>
                <span className={`chip chip--${severityChipClass(issue.severity)}`}>
                  {issue.severity}
                </span>{" "}
                <strong>{issue.finding}</strong>
                <p className="small muted">Evidence: {issue.evidence}</p>
                <p className="small">
                  <em>Fix:</em> {issue.recommendation}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
