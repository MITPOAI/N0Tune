import { useEffect, useMemo, useState } from "react";

import { createBackend } from "./backend";
import { Chat } from "./components/Chat";
import { ContextPreview } from "./components/ContextPreview";
import { MemoryViewer } from "./components/MemoryViewer";
import { Onboarding } from "./components/Onboarding";
import { PersonaSettings } from "./components/PersonaSettings";
import { ProviderSettings } from "./components/ProviderSettings";
import { QuickRemember } from "./components/QuickRemember";
import { StatusOverlay } from "./components/StatusOverlay";
import type {
  BackendStats,
  ChatResponse,
  ContextTrace,
  DesktopBackend,
  Memory,
  Persona,
  ProviderConfig,
} from "./types";

type TabKey = "chat" | "memories" | "context" | "persona" | "provider";

const TABS: { key: TabKey; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "memories", label: "Memories" },
  { key: "context", label: "Context" },
  { key: "persona", label: "Persona" },
  { key: "provider", label: "Provider" },
];

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

export function App() {
  const backend = useMemo<DesktopBackend>(() => createBackend(), []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [lastTrace, setLastTrace] = useState<ContextTrace | null>(null);
  const [tab, setTab] = useState<TabKey>("chat");
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<BackendStats>(INITIAL_STATS);

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
      // Treat the in-memory backend's cache_hit info as 0 for now (no
      // semantic cache in the stub). When the Gateway-backed mode ships,
      // we can read response.trace.cache_hit from the API.
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
    return response;
  }

  async function handleSaveMemory(text: string) {
    try {
      await backend.saveMemory({ text });
      setMemories(await backend.listMemories());
      setNotice("Memory saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleForget(id: string) {
    await backend.forgetMemory(id);
    setMemories(await backend.listMemories());
    setNotice("Memory removed.");
  }

  async function handleUpdatePersona(next: Partial<Persona>) {
    const updated = await backend.updatePersona(next);
    setPersona(updated);
    setNotice("Persona updated.");
  }

  async function handleSetProvider(next: ProviderConfig) {
    const saved = await backend.setProviderConfig(next);
    setProvider(saved);
    setNotice("Provider saved.");
    setShowOnboarding(false);
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="" className="brand-mark" />
          <span className="brand-tagline">Armor for your AI tools</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`tab ${tab === entry.key ? "tab--active" : ""}`}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
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

      <main className="app-body">
        {tab === "chat" && (
          <Chat
            persona={persona}
            onSend={handleChat}
            onSaveMemory={handleSaveMemory}
          />
        )}
        {tab === "memories" && (
          <MemoryViewer
            memories={memories}
            onForget={handleForget}
            onSave={handleSaveMemory}
          />
        )}
        {tab === "context" && <ContextPreview trace={lastTrace} />}
        {tab === "persona" && (
          <PersonaSettings persona={persona} onUpdate={handleUpdatePersona} />
        )}
        {tab === "provider" && (
          <ProviderSettings provider={provider} onSave={handleSetProvider} />
        )}
      </main>

      <StatusOverlay
        stats={stats}
        memoryCount={memories.length}
        providerLabel={stats.lastProvider ?? provider?.label ?? null}
      />

      <QuickRemember onSave={handleSaveMemory} />
    </div>
  );
}
