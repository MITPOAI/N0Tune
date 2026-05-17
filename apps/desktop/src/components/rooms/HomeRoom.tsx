import { useEffect, useMemo, useState } from "react";

import { RoomShell } from "./RoomShell";
import { PipelineDiagram } from "../home/PipelineDiagram";
import { SystemHealth } from "../home/SystemHealth";
import { ActivityFeed, type ActivityEvent } from "../home/ActivityFeed";
import type {
  BackendStats,
  Memory,
  Persona,
  ProviderConfig,
} from "../../types";

interface HomeRoomProps {
  stats: BackendStats;
  memories: Memory[];
  persona: Persona | null;
  provider: ProviderConfig | null;
  activity: ActivityEvent[];
  pipelineStage: "idle" | "embed" | "retrieve" | "compile" | "call" | "cache";
  onGoto: (room: "library" | "atelier" | "wire" | "guard" | "forge" | "chat") => void;
}

/**
 * Home — the lobby. What N0Tune is doing, what it has, what it
 * just did, in one screen. Not a chat input. Not a settings list.
 * It's the system map: counters, the pipeline animation, recent
 * activity. The four "doors" at the bottom are quick links to the
 * rooms a new user is most likely to want next.
 */
export function HomeRoom({
  stats,
  memories,
  persona,
  provider,
  activity,
  pipelineStage,
  onGoto,
}: HomeRoomProps) {
  // Stage that briefly highlights on the diagram whenever stats change.
  // For local-backend users without an actual SSE feed, this fires a
  // synthetic walk-through on the most recent chat so they see the
  // animation react to what they just did.
  const [highlight, setHighlight] = useState<HomeRoomProps["pipelineStage"]>(
    "idle",
  );
  useEffect(() => {
    if (stats.chats === 0) return;
    const stages: HomeRoomProps["pipelineStage"][] = [
      "embed",
      "retrieve",
      "compile",
      "call",
    ];
    let canceled = false;
    void (async () => {
      for (const stage of stages) {
        if (canceled) return;
        setHighlight(stage);
        await new Promise((resolve) => setTimeout(resolve, 320));
      }
      if (!canceled) setHighlight("idle");
    })();
    return () => {
      canceled = true;
    };
  }, [stats.chats]);
  const stage = pipelineStage === "idle" ? highlight : pipelineStage;

  const headline = useMemo(() => {
    if (!provider) return "Wire in a provider to start";
    return `Ready — calls go to ${provider.label}`;
  }, [provider]);

  return (
    <RoomShell
      icon="⌂"
      title="Home"
      subtitle={headline}
      actions={
        !provider ? (
          <button
            type="button"
            className="primary"
            onClick={() => onGoto("wire")}
          >
            Wire a provider
          </button>
        ) : null
      }
    >
      <div className="home-grid">
        <SystemHealth
          stats={stats}
          memories={memories}
          persona={persona}
          provider={provider}
        />

        <SavingsHero stats={stats} />

        <PipelineDiagram stage={stage} />

        <ActivityFeed activity={activity} onGoto={onGoto} />

        <div className="home-doors">
          <DoorCard
            icon="📚"
            label="Library"
            hint={`${memories.length} ${memories.length === 1 ? "memory" : "memories"}`}
            onClick={() => onGoto("library")}
          />
          <DoorCard
            icon="✎"
            label="Atelier"
            hint={persona ? `${persona.style.tone} tone` : "set persona"}
            onClick={() => onGoto("atelier")}
          />
          <DoorCard
            icon="🔥"
            label="Forge"
            hint={
              stats.chats > 0
                ? `${stats.chats} ${stats.chats === 1 ? "trace" : "traces"}`
                : "compile a prompt"
            }
            onClick={() => onGoto("forge")}
          />
          <DoorCard
            icon="⚖"
            label="Guard"
            hint="check a claim"
            onClick={() => onGoto("guard")}
          />
        </div>
      </div>
    </RoomShell>
  );
}

interface DoorCardProps {
  icon: string;
  label: string;
  hint: string;
  onClick: () => void;
}

function DoorCard({ icon, label, hint, onClick }: DoorCardProps) {
  return (
    <button type="button" className="home-door" onClick={onClick}>
      <span className="home-door-icon" aria-hidden>
        {icon}
      </span>
      <span className="home-door-label">{label}</span>
      <span className="home-door-hint">{hint}</span>
    </button>
  );
}

interface SavingsHeroProps {
  stats: BackendStats;
}

/**
 * The "is this worth my time?" headline. Big tabular numbers. The
 * answer is right in front of the user the moment they open the app,
 * not buried in a debug drawer.
 *
 * Math:
 *   savedPct = totalTokensSaved / totalNaiveTokens
 *
 * We deliberately *don't* show a percentage when the user has zero
 * chats yet — pretending we've saved them tokens before they've
 * even asked anything is dishonest.
 */
function SavingsHero({ stats }: SavingsHeroProps) {
  if (stats.chats === 0) {
    return (
      <section className="savings-hero savings-hero--empty">
        <span className="muted small">Token savings</span>
        <p className="savings-hero-empty">
          Send your first message in <strong>Chat</strong> — we'll show
          the saved tokens here, live, every request.
        </p>
      </section>
    );
  }
  const saved = stats.totalTokensSaved;
  const naive = stats.totalNaiveTokens || 1;
  const pct = Math.round((saved / naive) * 100);
  return (
    <section className="savings-hero">
      <div className="savings-hero-block">
        <span className="muted small">Tokens saved this session</span>
        <strong className="savings-hero-value">{saved.toLocaleString()}</strong>
      </div>
      <div className="savings-hero-block savings-hero-block--accent">
        <span className="muted small">vs naive baseline</span>
        <strong className="savings-hero-value">{pct}%</strong>
      </div>
      <div className="savings-hero-block">
        <span className="muted small">Average per request</span>
        <strong className="savings-hero-value">
          {Math.round(saved / stats.chats).toLocaleString()}
        </strong>
      </div>
    </section>
  );
}
