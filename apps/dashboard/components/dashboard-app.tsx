"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { apiBaseUrl } from "../lib/config";

type Memory = {
  id: string;
  type: string;
  text: string;
  confidence: number;
  source_message_id: string | null;
  expires_at: string | null;
  deleted_at: string | null;
};

type StyleProfile = {
  profile_json: Record<string, unknown>;
  updated_at: string;
};

type DocumentItem = {
  id: string;
  title: string;
  source: string;
  chunks: Array<{
    id: string;
    text: string;
    injection_risk_score: number;
    injection_risk_reasons_json: string[];
  }>;
};

type ContextPreview = {
  compiled_context: string;
  selected_memories: Memory[];
  selected_chunks: Array<{ id: string; text: string; injection_risk_score: number }>;
  prompt_tokens_estimated: number;
  tokens_saved_estimated: number;
  warnings: string[];
};

type CacheList = {
  entries: Array<{ id: string; input_hash: string; answer: string; model: string; created_at: string }>;
  total: number;
};

const tabs = ["Overview", "Memories", "Style", "Documents", "Context", "Cache", "Security"] as const;
type Tab = (typeof tabs)[number];

export function DashboardApp() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [appId, setAppId] = useState("demo");
  const [userId, setUserId] = useState("user_123");
  const [status, setStatus] = useState("Checking");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [style, setStyle] = useState<StyleProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [preview, setPreview] = useState<ContextPreview | null>(null);
  const [cache, setCache] = useState<CacheList | null>(null);
  const [message, setMessage] = useState("Explain RAG like before");
  const [notice, setNotice] = useState("");

  const baseUrl = useMemo(() => apiBaseUrl.replace(/\/$/, ""), []);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const body = (await response.json()) as T;
      if (!response.ok) {
        throw new Error(JSON.stringify(body));
      }
      return body;
    },
    [baseUrl],
  );

  const refresh = useCallback(async () => {
    try {
      const health = await request<{ status: string; dependencies: Record<string, string> }>(
        "/health?deep=true",
      );
      setStatus(`${health.status} / db ${health.dependencies.database} / redis ${health.dependencies.redis}`);
      const [memoryBody, styleBody, docsBody, cacheBody] = await Promise.all([
        request<Memory[]>(`/v1/memories?app_id=${appId}&user_id=${userId}`),
        request<StyleProfile>(`/v1/users/${userId}/style?app_id=${appId}`),
        request<DocumentItem[]>(`/v1/documents?app_id=${appId}`),
        request<CacheList>(`/v1/cache?app_id=${appId}&user_id=${userId}`),
      ]);
      setMemories(memoryBody);
      setStyle(styleBody);
      setDocuments(docsBody);
      setCache(cacheBody);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unknown dashboard refresh error");
    }
  }, [appId, request, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("/v1/memories", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: userId,
        type: form.get("type"),
        text: form.get("text"),
        confidence: Number(form.get("confidence")),
      }),
    });
    event.currentTarget.reset();
    await refresh();
  }

  async function updateStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/v1/users/${userId}/style`, {
      method: "PATCH",
      body: JSON.stringify({
        app_id: appId,
        profile_json: {
          tone: form.get("tone"),
          depth: form.get("depth"),
          format: form.get("format"),
          avoid: String(form.get("avoid") ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      }),
    });
    await refresh();
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request("/v1/documents", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        title: form.get("title"),
        source: form.get("source") || "dashboard",
        content: form.get("content"),
      }),
    });
    event.currentTarget.reset();
    await refresh();
  }

  async function previewContext(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = await request<ContextPreview>("/v1/context/preview", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: userId,
        message,
        max_context_tokens: 1200,
      }),
    });
    setPreview(body);
    await refresh();
  }

  async function clearCache() {
    await request(`/v1/cache?app_id=${appId}&user_id=${userId}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="min-h-screen bg-field text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm font-bold text-white">
              N0
            </div>
            <div>
              <h1 className="text-base font-semibold">N0Tune</h1>
              <p className="text-xs text-ink/60">Memory, RAG, cache, and context compiler gateway</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Field label="app_id" value={appId} onChange={setAppId} />
            <Field label="user_id" value={userId} onChange={setUserId} />
            <button className="rounded-md bg-ink px-3 py-2 font-medium text-white" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                tab === item ? "border-ink bg-white text-ink" : "border-line bg-transparent text-ink/64"
              }`}
              key={item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {notice ? <div className="mb-4 rounded-md border border-rust/30 bg-rust/10 p-3 text-sm">{notice}</div> : null}

        {tab === "Overview" && <Overview status={status} memories={memories} documents={documents} cache={cache} />}
        {tab === "Memories" && <Memories memories={memories} onCreate={createMemory} />}
        {tab === "Style" && <StylePanel style={style} onSubmit={updateStyle} />}
        {tab === "Documents" && <Documents documents={documents} onCreate={createDocument} />}
        {tab === "Context" && (
          <ContextPanel message={message} setMessage={setMessage} preview={preview} onPreview={previewContext} />
        )}
        {tab === "Cache" && <CachePanel cache={cache} onClear={clearCache} />}
        {tab === "Security" && <SecurityPanel />}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-line bg-field px-2 py-1">
      <span className="text-xs text-ink/55">{label}</span>
      <input
        className="w-32 bg-transparent text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-line bg-white p-5 shadow-panel">{children}</div>;
}

function Overview({
  status,
  memories,
  documents,
  cache,
}: {
  status: string;
  memories: Memory[];
  documents: DocumentItem[];
  cache: CacheList | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {[
        ["API", status],
        ["Memories", String(memories.length)],
        ["Documents", String(documents.length)],
        ["Cache entries", String(cache?.total ?? 0)],
      ].map(([label, value]) => (
        <Panel key={label}>
          <p className="text-sm text-ink/56">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </Panel>
      ))}
    </div>
  );
}

function Memories({ memories, onCreate }: { memories: Memory[]; onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel>
        <h2 className="text-lg font-semibold">Save memory</h2>
        <form className="mt-4 space-y-3" onSubmit={onCreate}>
          <input className="input" name="type" defaultValue="preference" />
          <textarea className="input min-h-28" name="text" placeholder="User prefers concise architecture notes." />
          <input className="input" name="confidence" type="number" step="0.01" min="0" max="1" defaultValue="0.8" />
          <button className="button">Save</button>
        </form>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold">Memory list</h2>
        <div className="mt-4 space-y-3">
          {memories.map((memory) => (
            <div className="rounded-md border border-line p-3" key={memory.id}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{memory.type}</span>
                <span>{Math.round(memory.confidence * 100)}%</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/72">{memory.text}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StylePanel({ style, onSubmit }: { style: StyleProfile | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const profile = style?.profile_json ?? {};
  return (
    <Panel>
      <h2 className="text-lg font-semibold">Style profile</h2>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <input className="input" name="tone" defaultValue={String(profile.tone ?? "practical")} />
        <input className="input" name="depth" defaultValue={String(profile.depth ?? "medium")} />
        <input className="input md:col-span-2" name="format" defaultValue={String(profile.format ?? "bullets")} />
        <input className="input md:col-span-2" name="avoid" defaultValue={Array.isArray(profile.avoid) ? profile.avoid.join(", ") : ""} />
        <button className="button md:col-span-2">Update profile</button>
      </form>
    </Panel>
  );
}

function Documents({ documents, onCreate }: { documents: DocumentItem[]; onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <Panel>
        <h2 className="text-lg font-semibold">Add document</h2>
        <form className="mt-4 space-y-3" onSubmit={onCreate}>
          <input className="input" name="title" placeholder="Architecture note" />
          <input className="input" name="source" placeholder="dashboard" />
          <textarea className="input min-h-40" name="content" placeholder="Paste document text" />
          <button className="button">Index document</button>
        </form>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold">Documents and chunks</h2>
        <div className="mt-4 space-y-4">
          {documents.map((doc) => (
            <div className="rounded-md border border-line p-3" key={doc.id}>
              <p className="font-semibold">{doc.title}</p>
              <p className="text-xs text-ink/55">{doc.source}</p>
              {doc.chunks.map((chunk) => (
                <div className="mt-3 rounded-md bg-field p-3 text-sm" key={chunk.id}>
                  <p className="line-clamp-3">{chunk.text}</p>
                  <p className="mt-2 text-xs text-rust">risk {chunk.injection_risk_score.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ContextPanel({
  message,
  setMessage,
  preview,
  onPreview,
}: {
  message: string;
  setMessage: (value: string) => void;
  preview: ContextPreview | null;
  onPreview: (event?: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <Panel>
        <h2 className="text-lg font-semibold">Context preview</h2>
        <form className="mt-4 space-y-3" onSubmit={onPreview}>
          <textarea className="input min-h-36" value={message} onChange={(event) => setMessage(event.target.value)} />
          <button className="button">Compile context</button>
        </form>
      </Panel>
      <Panel>
        <div className="flex flex-wrap gap-3 text-sm">
          <span>prompt tokens {preview?.prompt_tokens_estimated ?? 0}</span>
          <span>saved {preview?.tokens_saved_estimated ?? 0}</span>
          <span>warnings {preview?.warnings.length ?? 0}</span>
        </div>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-md bg-ink p-4 text-xs leading-5 text-white">
          {preview?.compiled_context ?? "No preview yet."}
        </pre>
      </Panel>
    </div>
  );
}

function CachePanel({ cache, onClear }: { cache: CacheList | null; onClear: () => void }) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Semantic cache</h2>
        <button className="button" onClick={onClear}>Clear cache</button>
      </div>
      <div className="mt-4 space-y-3">
        {cache?.entries.map((entry) => (
          <div className="rounded-md border border-line p-3 text-sm" key={entry.id}>
            <p className="font-semibold">{entry.model}</p>
            <p className="mt-1 text-ink/60">{entry.input_hash.slice(0, 16)}</p>
            <p className="mt-2 line-clamp-2">{entry.answer}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SecurityPanel() {
  return (
    <Panel>
      <h2 className="text-lg font-semibold">Security controls</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          "Memory storage rejects common API keys, passwords, private keys, tokens, and cookies.",
          "Retrieved document chunks receive prompt-injection risk scores.",
          "High-risk chunks are excluded from compiled context by default.",
          "Every API query is scoped by app_id and user_id where applicable.",
          "OpenAI-compatible proxy supports app API key validation.",
          "Context traces explain why memories and chunks were selected or excluded.",
        ].map((item) => (
          <div className="rounded-md border border-line bg-field p-3 text-sm leading-6" key={item}>
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}
