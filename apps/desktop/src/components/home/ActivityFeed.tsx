export interface ActivityEvent {
  id: string;
  kind: "memory_saved" | "memory_forgotten" | "chat" | "persona_updated" | "provider_set";
  text: string;
  at: string; // ISO timestamp
}

interface ActivityFeedProps {
  activity: ActivityEvent[];
  onGoto: (room: "library" | "atelier" | "wire" | "guard" | "forge" | "chat") => void;
}

const ICON_BY_KIND: Record<ActivityEvent["kind"], string> = {
  memory_saved: "✚",
  memory_forgotten: "✕",
  chat: "▶",
  persona_updated: "✎",
  provider_set: "🔌",
};

const ROOM_BY_KIND: Record<ActivityEvent["kind"], Parameters<ActivityFeedProps["onGoto"]>[0]> = {
  memory_saved: "library",
  memory_forgotten: "library",
  chat: "forge",
  persona_updated: "atelier",
  provider_set: "wire",
};

/**
 * Recent events from THIS desktop session — what N0Tune just did.
 * No backend feed needed; the App state machine appends events
 * locally as the user works. Click any row to jump to the room
 * where that thing lives.
 */
export function ActivityFeed({ activity, onGoto }: ActivityFeedProps) {
  return (
    <section className="activity" aria-label="Recent activity">
      <header className="activity-header">
        <h2>Activity</h2>
        <span className="chip">{activity.length}</span>
      </header>
      {activity.length === 0 ? (
        <p className="empty">
          Nothing yet this session. Save a memory or send a message — events
          land here.
        </p>
      ) : (
        <ul className="activity-list">
          {activity.slice(0, 8).map((event) => (
            <li key={event.id} className="activity-row">
              <button
                type="button"
                className="activity-button"
                onClick={() => onGoto(ROOM_BY_KIND[event.kind])}
              >
                <span className="activity-icon" aria-hidden>
                  {ICON_BY_KIND[event.kind]}
                </span>
                <span className="activity-text">{event.text}</span>
                <span className="activity-time muted small">
                  {formatTime(event.at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffSec = Math.max(0, Math.round((now - date.getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    return `${Math.round(diffSec / 3600)}h ago`;
  } catch {
    return "";
  }
}
