import type { BackendStats } from "../types";

interface StatusOverlayProps {
  stats: BackendStats;
  memoryCount: number;
  providerLabel: string | null;
}

/**
 * Session-level status overlay.
 *
 * Sits in the window footer (always visible). Shows:
 *  - session token total (compiled prompt tokens summed across chats)
 *  - cache hit rate
 *  - active memory count (how many memories are saved right now)
 *  - tailored / naive ratio (smaller is better)
 *  - last provider used
 *
 * Reads only from props; no API calls. The parent (App.tsx) accumulates
 * the rolling stats from each ChatResponse.trace.
 */
export function StatusOverlay({
  stats,
  memoryCount,
  providerLabel,
}: StatusOverlayProps) {
  const hitRate =
    stats.chats > 0 ? Math.round((stats.cacheHits / stats.chats) * 100) : 0;
  const savings =
    stats.totalNaiveTokens > 0
      ? Math.round(
          ((stats.totalNaiveTokens - stats.totalPromptTokens) /
            stats.totalNaiveTokens) *
            100,
        )
      : 0;

  return (
    <footer className="status-overlay" aria-label="Session status">
      <span className="status-metric" title="Memories saved in your local store">
        <strong>{memoryCount}</strong>
        <span className="status-label">memories</span>
      </span>
      <span className="status-divider" aria-hidden="true">
        ·
      </span>
      <span className="status-metric" title="Total compiled prompt tokens this session">
        <strong>{stats.totalPromptTokens.toLocaleString()}</strong>
        <span className="status-label">tokens compiled</span>
      </span>
      <span className="status-divider" aria-hidden="true">
        ·
      </span>
      <span
        className="status-metric"
        title="How many tokens vs. a naive 'stuff everything in' baseline"
      >
        <strong>{savings}%</strong>
        <span className="status-label">saved</span>
      </span>
      <span className="status-divider" aria-hidden="true">
        ·
      </span>
      <span className="status-metric" title="Semantic cache hit rate this session">
        <strong>{hitRate}%</strong>
        <span className="status-label">cache</span>
      </span>
      <span className="status-divider" aria-hidden="true">
        ·
      </span>
      <span className="status-metric" title="The provider that answered most recently">
        <strong>{providerLabel ?? "no provider"}</strong>
        <span className="status-label">provider</span>
      </span>
      {stats.warningCount > 0 && (
        <>
          <span className="status-divider" aria-hidden="true">
            ·
          </span>
          <span
            className="status-metric status-metric--warn"
            title="Warnings emitted by the compiler this session"
          >
            <strong>{stats.warningCount}</strong>
            <span className="status-label">warnings</span>
          </span>
        </>
      )}
    </footer>
  );
}
