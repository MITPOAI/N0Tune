import type {
  BackendStats,
  Memory,
  Persona,
  ProviderConfig,
} from "../../types";

interface SystemHealthProps {
  stats: BackendStats;
  memories: Memory[];
  persona: Persona | null;
  provider: ProviderConfig | null;
}

/**
 * Top strip of the Home room — what's wired, what's stored, what
 * just ran. Five status pills. Each one signals at a glance with
 * a calm dot color (no red unless something is actually broken).
 */
export function SystemHealth({
  stats,
  memories,
  persona,
  provider,
}: SystemHealthProps) {
  return (
    <ul className="status-pills" aria-label="System health">
      <Pill
        ok={Boolean(provider)}
        label="Provider"
        value={provider ? provider.label : "not wired"}
      />
      <Pill ok={memories.length > 0} label="Memory" value={`${memories.length}`} />
      <Pill
        ok={Boolean(persona)}
        label="Persona"
        value={persona?.name ?? "default"}
      />
      <Pill
        ok={stats.chats > 0}
        label="Chats"
        value={`${stats.chats}`}
      />
      <Pill
        ok={stats.warningCount === 0}
        label="Warnings"
        value={`${stats.warningCount}`}
        warn={stats.warningCount > 0}
      />
    </ul>
  );
}

interface PillProps {
  ok: boolean;
  label: string;
  value: string;
  warn?: boolean;
}

function Pill({ ok, label, value, warn }: PillProps) {
  const tone = warn ? "warn" : ok ? "ok" : "muted";
  return (
    <li className={`status-pill status-pill--${tone}`}>
      <span className="status-pill-dot" aria-hidden />
      <span className="status-pill-label">{label}</span>
      <strong className="status-pill-value">{value}</strong>
    </li>
  );
}
