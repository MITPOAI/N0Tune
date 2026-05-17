import { useCallback, useEffect, useMemo, useState } from "react";

import { createBackend } from "./backend";
import { Chat } from "./components/Chat";
import { Onboarding } from "./components/Onboarding";
import { QuickRemember } from "./components/QuickRemember";
import { Sidebar, type RoomKey } from "./components/Sidebar";
import { StatusOverlay } from "./components/StatusOverlay";
import { AtelierRoom } from "./components/rooms/AtelierRoom";
import { ForgeRoom } from "./components/rooms/ForgeRoom";
import { GuardRoom } from "./components/rooms/GuardRoom";
import { HomeRoom } from "./components/rooms/HomeRoom";
import { LibraryRoom } from "./components/rooms/LibraryRoom";
import { RoomShell } from "./components/rooms/RoomShell";
import { WireRoom } from "./components/rooms/WireRoom";
import type { ActivityEvent } from "./components/home/ActivityFeed";
import type {
  BackendStats,
  ChatResponse,
  ContextTrace,
  DesktopBackend,
  Memory,
  Persona,
  ProviderConfig,
} from "./types";

const INITIAL_STATS: BackendStats = {
  chats: 0,
  cacheHits: 0,
  totalPromptTokens: 0,
  totalTokensSaved: 0,
  totalNaiveTokens: 0,
  memoriesUsed: 0,
  lastProvider: null,
  warningCount: 0,
};

const MAX_ACTIVITY = 24;

function newEvent(
  kind: ActivityEvent["kind"],
  text: string,
): ActivityEvent {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    text,
    at: new Date().toISOString(),
  };
}

export function App() {
  const backend = useMemo<DesktopBackend>(() => createBackend(), []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [lastTrace, setLastTrace] = useState<ContextTrace | null>(null);
  const [room, setRoom] = useState<RoomKey>("home");
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<BackendStats>(INITIAL_STATS);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const pushActivity = useCallback(
    (kind: ActivityEvent["kind"], text: string) => {
      setActivity((prev) => [newEvent(kind, text), ...prev].slice(0, MAX_ACTIVITY));
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const [providerConfig, personaConfig, memoryList] = await Promise.all([
        backend.getProviderConfig(),
        backend.getPersona(),
        backend.listMemories(),
      ]);
      setProvider(providerConfig);
      setPersona(personaConfig);
      setMemories(memoryList);
      setShowOnboarding(providerConfig === null);
    })();
  }, [backend]);

  async function handleChat(message: string): Promise<ChatResponse> {
    const response = await backend.chat(message);
    setLastTrace(response.trace);
    const refreshed = await backend.listMemories();
    setMemories(refreshed);
    setStats((prev) => {
      const compiled = response.trace.prompt_tokens_estimated;
      const saved = response.trace.tokens_saved_estimated;
      const naive = compiled + saved;
      return {
        chats: prev.chats + 1,
        cacheHits: prev.cacheHits,
        totalPromptTokens: prev.totalPromptTokens + compiled,
        totalTokensSaved: prev.totalTokensSaved + saved,
        totalNaiveTokens: prev.totalNaiveTokens + naive,
        memoriesUsed: prev.memoriesUsed + response.trace.selected_memories.length,
        lastProvider: response.provider,
        warningCount: prev.warningCount + response.trace.warnings.length,
      };
    });
    pushActivity(
      "chat",
      `Sent message via ${response.provider} — ${response.trace.prompt_tokens_estimated} tokens`,
    );
    return response;
  }

  async function handleSaveMemory(text: string) {
    try {
      const saved = await backend.saveMemory({ text });
      setMemories(await backend.listMemories());
      setNotice("Memory saved.");
      pushActivity(
        "memory_saved",
        `Saved ${saved.type}: ${truncate(saved.text, 64)}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleForget(id: string) {
    const removed = memories.find((m) => m.id === id);
    await backend.forgetMemory(id);
    setMemories(await backend.listMemories());
    setNotice("Memory removed.");
    if (removed) {
      pushActivity(
        "memory_forgotten",
        `Forgot: ${truncate(removed.text, 64)}`,
      );
    }
  }

  async function handleUpdatePersona(next: Partial<Persona>) {
    const updated = await backend.updatePersona(next);
    setPersona(updated);
    setNotice("Persona updated.");
    pushActivity(
      "persona_updated",
      `Persona ${updated.name} — ${updated.style.tone} tone, ${updated.style.depth} depth`,
    );
  }

  async function handleSetProvider(next: ProviderConfig) {
    const saved = await backend.setProviderConfig(next);
    setProvider(saved);
    setNotice("Provider saved.");
    setShowOnboarding(false);
    pushActivity("provider_set", `Wired ${saved.label}`);
  }

  if (showOnboarding) {
    return (
      <Onboarding
        persona={persona}
        onComplete={async ({ persona: personaInput, provider: providerInput }) => {
          if (personaInput) await handleUpdatePersona(personaInput);
          await handleSetProvider(providerInput);
        }}
      />
    );
  }

  function gotoRoom(target: RoomKey) {
    setRoom(target);
  }

  return (
    <div className="app app--mansion">
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="" className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">N0Tune</span>
            <span className="brand-tagline">
              Fine-tune any AI, without fine-tuning
            </span>
          </div>
        </div>
        <div className="brand-meta">
          <span className="badge">{provider?.label ?? "no provider"}</span>
          <button
            type="button"
            className="link"
            onClick={() => setShowOnboarding(true)}
          >
            Reconfigure
          </button>
        </div>
      </header>

      {notice ? (
        <div className="notice" role="status">
          {notice}
          <button type="button" className="link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      <div className="mansion">
        <Sidebar active={room} onSelect={setRoom} />

        <main className="mansion-content">
          {room === "home" && (
            <HomeRoom
              stats={stats}
              memories={memories}
              persona={persona}
              provider={provider}
              activity={activity}
              pipelineStage="idle"
              onGoto={gotoRoom}
            />
          )}
          {room === "library" && (
            <LibraryRoom
              memories={memories}
              onForget={handleForget}
              onSave={handleSaveMemory}
            />
          )}
          {room === "atelier" && (
            <AtelierRoom persona={persona} onUpdate={handleUpdatePersona} />
          )}
          {room === "wire" && (
            <WireRoom provider={provider} onSave={handleSetProvider} />
          )}
          {room === "guard" && <GuardRoom />}
          {room === "forge" && <ForgeRoom trace={lastTrace} />}
          {room === "chat" && (
            <RoomShell
              icon="▢"
              title="Chat"
              subtitle="Fallback chat — for when no other AI tool is open"
            >
              <Chat
                persona={persona}
                onSend={handleChat}
                onSaveMemory={handleSaveMemory}
              />
            </RoomShell>
          )}
        </main>
      </div>

      <StatusOverlay
        stats={stats}
        memoryCount={memories.length}
        providerLabel={stats.lastProvider ?? provider?.label ?? null}
      />

      <QuickRemember onSave={handleSaveMemory} />
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
