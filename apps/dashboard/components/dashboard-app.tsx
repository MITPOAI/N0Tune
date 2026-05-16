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
  similarity?: number | null;
};

type StyleProfile = {
  profile_json: Record<string, unknown>;
  updated_at: string;
};

type Chunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  metadata_json?: Record<string, unknown>;
  injection_risk_score: number;
  injection_risk_reasons_json?: string[];
  similarity?: number | null;
};

type DocumentItem = {
  id: string;
  title: string;
  source: string;
  chunks: Chunk[];
};

type TraceItem = {
  type: string;
  id: string;
  reason: string;
};

type ContextPreview = {
  compiled_context: string;
  selected_memories: Memory[];
  selected_chunks: Chunk[];
  style_profile: Record<string, unknown>;
  cache_hit: boolean;
  prompt_tokens_estimated: number;
  tokens_saved_estimated: number;
  warnings: string[];
  context_trace: {
    why_selected: TraceItem[];
    excluded: TraceItem[];
  };
};

type CacheList = {
  entries: Array<{
    id: string;
    input_hash: string;
    answer: string;
    model: string;
    created_at: string;
  }>;
  total: number;
};

type AuditLog = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_role: string | null;
  created_at: string;
  metadata_json: Record<string, unknown>;
};

const tabs = [
  "Overview",
  "Context Lab",
  "Memories",
  "Style",
  "Documents",
  "Context",
  "Cache",
  "Audit",
  "Security",
] as const;
type Tab = (typeof tabs)[number];

const labDocumentTitle = "Context Lab RAG note";
const labDocumentContent =
  "RAG retrieves external documents. N0Tune combines RAG with personal memory, response style, local files, semantic cache, and a compact context compiler. The same model can receive different context for different users without fine-tuning.";

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
  const [labUserA, setLabUserA] = useState("context_lab_user_a");
  const [labUserB, setLabUserB] = useState("context_lab_user_b");
  const [labQuestion, setLabQuestion] = useState(
    "How should I explain RAG to a product team?",
  );
  const [labPreviewA, setLabPreviewA] = useState<ContextPreview | null>(null);
  const [labPreviewB, setLabPreviewB] = useState<ContextPreview | null>(null);
  const [labNotice, setLabNotice] = useState(
    "Context preview only. No LLM response is generated here.",
  );
  const [labRunning, setLabRunning] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditKey, setAuditKey] = useState("");
  const [auditNotice, setAuditNotice] = useState(
    "Audit logs require an owner/admin API key.",
  );

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
      const health = await request<{
        status: string;
        dependencies: Record<string, string>;
      }>("/health?deep=true");
      setStatus(
        `${health.status} / db ${health.dependencies.database} / redis ${health.dependencies.redis}`,
      );
      const [memoryBody, styleBody, docsBody, cacheBody] = await Promise.all([
        request<Memory[]>(
          `/v1/memories?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
        ),
        request<StyleProfile>(
          `/v1/users/${encodeURIComponent(userId)}/style?app_id=${encodeURIComponent(appId)}`,
        ),
        request<DocumentItem[]>(
          `/v1/documents?app_id=${encodeURIComponent(appId)}`,
        ),
        request<CacheList>(
          `/v1/cache?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
        ),
      ]);
      setMemories(memoryBody);
      setStyle(styleBody);
      setDocuments(docsBody);
      setCache(cacheBody);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unknown dashboard refresh error",
      );
    }
  }, [appId, request, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
    formElement.reset();
    await refresh();
  }

  async function deleteMemory(memoryId: string) {
    await request(
      `/v1/memories/${encodeURIComponent(memoryId)}?app_id=${encodeURIComponent(appId)}`,
      {
        method: "DELETE",
      },
    );
    await refresh();
  }

  async function updateStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/v1/users/${encodeURIComponent(userId)}/style`, {
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await request("/v1/documents", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        title: form.get("title"),
        source: form.get("source") || "dashboard",
        content: form.get("content"),
      }),
    });
    formElement.reset();
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
    await request(
      `/v1/cache?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
      },
    );
    await refresh();
  }

  async function loadAuditLogs(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!auditKey.trim()) {
      setAuditNotice("Enter a local owner/admin API key to load audit logs.");
      return;
    }
    try {
      const logs = await request<AuditLog[]>(
        `/v1/audit-logs?app_id=${encodeURIComponent(appId)}&limit=50`,
        {
          headers: { "X-N0Tune-API-Key": auditKey },
        },
      );
      setAuditLogs(logs);
      setAuditNotice(`${logs.length} audit log entries loaded.`);
    } catch (error) {
      setAuditNotice(
        error instanceof Error ? error.message : "Unable to load audit logs.",
      );
    }
  }

  async function seedContextLab() {
    setLabRunning(true);
    setLabNotice("Creating/selecting User A and User B demo context...");
    try {
      await Promise.all([
        ensureMemory(
          labUserA,
          "style",
          "When explaining RAG, User A prefers short technical bullets, direct tradeoffs, and no motivational framing.",
        ),
        ensureMemory(
          labUserB,
          "style",
          "When explaining RAG, User B prefers analogy-rich walkthroughs, examples, and a friendly coaching tone.",
        ),
        updateUserStyle(labUserA, {
          tone: "direct",
          depth: "medium",
          format: "short technical bullets",
          avoid: ["hype", "long theory"],
        }),
        updateUserStyle(labUserB, {
          tone: "friendly",
          depth: "high",
          format: "analogy + example + steps",
          avoid: ["terse answers"],
        }),
        ensureLabDocument(),
      ]);
      await runContextLab();
      setLabNotice(
        "Context Lab seeded and previewed. No LLM response was generated.",
      );
    } catch (error) {
      setLabNotice(
        error instanceof Error ? error.message : "Context Lab setup failed.",
      );
    } finally {
      setLabRunning(false);
      await refresh();
    }
  }

  async function runContextLab(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLabRunning(true);
    setLabNotice(
      "Calling /v1/context/preview for both users. No LLM response is generated.",
    );
    try {
      const [previewA, previewB] = await Promise.all([
        contextPreviewFor(labUserA, labQuestion),
        contextPreviewFor(labUserB, labQuestion),
      ]);
      setLabPreviewA(previewA);
      setLabPreviewB(previewB);
      setLabNotice(
        "Side-by-side context preview complete. Same question, different compiled context.",
      );
    } catch (error) {
      setLabNotice(
        error instanceof Error ? error.message : "Context Lab preview failed.",
      );
    } finally {
      setLabRunning(false);
    }
  }

  async function ensureMemory(
    targetUserId: string,
    type: string,
    text: string,
  ) {
    const existing = await request<Memory[]>(
      `/v1/memories?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(targetUserId)}&limit=200`,
    );
    if (existing.some((memory) => memory.text === text)) {
      return;
    }
    await request<Memory>("/v1/memories", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: targetUserId,
        type,
        text,
        confidence: 1,
      }),
    });
  }

  async function updateUserStyle(
    targetUserId: string,
    profile: Record<string, unknown>,
  ) {
    await request<StyleProfile>(
      `/v1/users/${encodeURIComponent(targetUserId)}/style`,
      {
        method: "PATCH",
        body: JSON.stringify({
          app_id: appId,
          profile_json: profile,
        }),
      },
    );
  }

  async function ensureLabDocument() {
    const docs = await request<DocumentItem[]>(
      `/v1/documents?app_id=${encodeURIComponent(appId)}`,
    );
    if (docs.some((doc) => doc.title === labDocumentTitle)) {
      return;
    }
    await request<DocumentItem>("/v1/documents", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        title: labDocumentTitle,
        source: "context-lab",
        content: labDocumentContent,
      }),
    });
  }

  async function contextPreviewFor(
    targetUserId: string,
    targetMessage: string,
  ) {
    return request<ContextPreview>("/v1/context/preview", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: targetUserId,
        message: targetMessage,
        max_context_tokens: 1200,
      }),
    });
  }

  return (
    <main className="min-h-screen bg-field text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <div className="flex items-center gap-3" aria-label="N0Tune">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              className="h-8 w-auto block select-none"
              draggable={false}
            />
            <span className="hidden text-xs uppercase tracking-wide text-ink/55 sm:inline">
              Armor for your AI tools
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Field label="app_id" value={appId} onChange={setAppId} />
            <Field label="user_id" value={userId} onChange={setUserId} />
            <button
              type="button"
              className="button"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6">
        <div
          className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {tabs.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${
                tab === item
                  ? "border-ink bg-white text-ink"
                  : "border-line bg-transparent text-ink/64 hover:text-ink"
              }`}
              key={item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {notice ? (
          <div className="mb-4 rounded-md border border-rust/30 bg-rust/10 p-3 text-sm">
            {notice}
          </div>
        ) : null}

        {tab === "Overview" && (
          <Overview
            status={status}
            memories={memories}
            documents={documents}
            cache={cache}
          />
        )}
        {tab === "Context Lab" && (
          <ContextLab
            userA={labUserA}
            setUserA={setLabUserA}
            userB={labUserB}
            setUserB={setLabUserB}
            question={labQuestion}
            setQuestion={setLabQuestion}
            previewA={labPreviewA}
            previewB={labPreviewB}
            notice={labNotice}
            running={labRunning}
            onSeed={() => void seedContextLab()}
            onRun={runContextLab}
          />
        )}
        {tab === "Memories" && (
          <Memories
            memories={memories}
            onCreate={createMemory}
            onDelete={deleteMemory}
          />
        )}
        {tab === "Style" && <StylePanel style={style} onSubmit={updateStyle} />}
        {tab === "Documents" && (
          <Documents documents={documents} onCreate={createDocument} />
        )}
        {tab === "Context" && (
          <ContextPanel
            message={message}
            setMessage={setMessage}
            preview={preview}
            onPreview={previewContext}
          />
        )}
        {tab === "Cache" && <CachePanel cache={cache} onClear={clearCache} />}
        {tab === "Audit" && (
          <AuditPanel
            apiKey={auditKey}
            setApiKey={setAuditKey}
            logs={auditLogs}
            notice={auditNotice}
            onLoad={loadAuditLogs}
          />
        )}
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
        className="w-24 sm:w-36 bg-transparent text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
      {children}
    </div>
  );
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

function ContextLab({
  userA,
  setUserA,
  userB,
  setUserB,
  question,
  setQuestion,
  previewA,
  previewB,
  notice,
  running,
  onSeed,
  onRun,
}: {
  userA: string;
  setUserA: (value: string) => void;
  userB: string;
  setUserB: (value: string) => void;
  question: string;
  setQuestion: (value: string) => void;
  previewA: ContextPreview | null;
  previewB: ContextPreview | null;
  notice: string;
  running: boolean;
  onSeed: () => void;
  onRun: (event?: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Context Lab</h2>
            <p className="mt-1 text-sm text-ink/60">
              Same question, same model path, different N0Tune memory/style/file
              context. This uses context preview only.
            </p>
          </div>
          <span className="rounded-md border border-moss/30 bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
            No fake LLM response
          </span>
        </div>

        <form
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto_auto]"
          onSubmit={onRun}
        >
          <input
            className="input"
            value={userA}
            onChange={(event) => setUserA(event.target.value)}
            aria-label="User A id"
          />
          <input
            className="input"
            value={userB}
            onChange={(event) => setUserB(event.target.value)}
            aria-label="User B id"
          />
          <input
            className="input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-label="Shared question"
          />
          <button
            className="button"
            type="button"
            disabled={running}
            onClick={onSeed}
          >
            Seed demo
          </button>
          <button className="button" disabled={running}>
            Run preview
          </button>
        </form>
        <p className="mt-3 text-sm text-ink/64">{notice}</p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <PreviewCard label="User A" userId={userA} preview={previewA} />
        <PreviewCard label="User B" userId={userB} preview={previewB} />
      </div>
    </div>
  );
}

function Memories({
  memories,
  onCreate,
  onDelete,
}: {
  memories: Memory[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (memoryId: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel>
        <h2 className="text-lg font-semibold">Save memory</h2>
        <form className="mt-4 space-y-3" onSubmit={onCreate}>
          <input className="input" name="type" defaultValue="preference" />
          <textarea
            className="input min-h-28"
            name="text"
            placeholder="User prefers concise architecture notes."
          />
          <input
            className="input"
            name="confidence"
            type="number"
            step="0.01"
            min="0"
            max="1"
            defaultValue="0.8"
          />
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
              <p className="mt-2 text-sm leading-6 text-ink/72">
                {memory.text}
              </p>
              <button
                className="mt-3 rounded-md border border-line px-3 py-1 text-xs font-semibold"
                onClick={() => onDelete(memory.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function StylePanel({
  style,
  onSubmit,
}: {
  style: StyleProfile | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const profile = style?.profile_json ?? {};
  return (
    <Panel>
      <h2 className="text-lg font-semibold">Style profile</h2>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <input
          className="input"
          name="tone"
          defaultValue={String(profile.tone ?? "practical")}
        />
        <input
          className="input"
          name="depth"
          defaultValue={String(profile.depth ?? "medium")}
        />
        <input
          className="input md:col-span-2"
          name="format"
          defaultValue={String(profile.format ?? "bullets")}
        />
        <input
          className="input md:col-span-2"
          name="avoid"
          defaultValue={
            Array.isArray(profile.avoid) ? profile.avoid.join(", ") : ""
          }
        />
        <button className="button md:col-span-2">Update profile</button>
      </form>
    </Panel>
  );
}

function Documents({
  documents,
  onCreate,
}: {
  documents: DocumentItem[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <Panel>
        <h2 className="text-lg font-semibold">Add document</h2>
        <form className="mt-4 space-y-3" onSubmit={onCreate}>
          <input
            className="input"
            name="title"
            placeholder="Architecture note"
          />
          <input className="input" name="source" placeholder="dashboard" />
          <textarea
            className="input min-h-40"
            name="content"
            placeholder="Paste document text"
          />
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
                <div
                  className="mt-3 rounded-md bg-field p-3 text-sm"
                  key={chunk.id}
                >
                  <p className="line-clamp-3">{chunk.text}</p>
                  <p className="mt-2 text-xs text-rust">
                    risk {chunk.injection_risk_score.toFixed(2)}
                  </p>
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
          <textarea
            className="input min-h-36"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button className="button">Compile context</button>
        </form>
      </Panel>
      <PreviewCard
        label="Current user"
        userId="selected header user"
        preview={preview}
      />
    </div>
  );
}

function PreviewCard({
  label,
  userId,
  preview,
}: {
  label: string;
  userId: string;
  preview: ContextPreview | null;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="text-xs text-ink/56">{userId}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Metric
            label="tokens"
            value={String(preview?.prompt_tokens_estimated ?? 0)}
          />
          <Metric
            label="saved"
            value={String(preview?.tokens_saved_estimated ?? 0)}
          />
          <Metric
            label="warnings"
            value={String(preview?.warnings.length ?? 0)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DetailList
          title="Selected memories"
          empty="No selected memories"
          items={preview?.selected_memories.map(memoryLabel) ?? []}
        />
        <DetailList
          title="Selected docs"
          empty="No selected chunks"
          items={preview?.selected_chunks.map(chunkLabel) ?? []}
        />
      </div>

      {preview?.warnings.length ? (
        <DetailList
          title="Warnings"
          empty=""
          items={preview.warnings}
          tone="warning"
        />
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DetailList
          title="Trace: selected"
          empty="No trace yet"
          items={preview?.context_trace.why_selected.map(traceLabel) ?? []}
        />
        <DetailList
          title="Trace: excluded"
          empty="Nothing excluded"
          items={preview?.context_trace.excluded.map(traceLabel) ?? []}
        />
      </div>

      <pre className="mt-4 max-h-[420px] overflow-auto rounded-md bg-ink p-4 text-xs leading-5 text-white">
        {preview?.compiled_context ?? "No preview yet."}
      </pre>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-line bg-field px-2 py-1">
      {label} {value}
    </span>
  );
}

function DetailList({
  title,
  empty,
  items,
  tone = "neutral",
}: {
  title: string;
  empty: string;
  items: string[];
  tone?: "neutral" | "warning";
}) {
  return (
    <section className="mt-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p
              className={`rounded-md border p-2 text-xs leading-5 ${
                tone === "warning"
                  ? "border-rust/30 bg-rust/10"
                  : "border-line bg-field"
              }`}
              key={item}
            >
              {item}
            </p>
          ))
        ) : empty ? (
          <p className="rounded-md border border-line bg-field p-2 text-xs text-ink/58">
            {empty}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function memoryLabel(memory: Memory) {
  const similarity =
    typeof memory.similarity === "number"
      ? ` similarity ${memory.similarity.toFixed(2)}`
      : "";
  return `[${memory.type}] ${memory.text}${similarity}`;
}

function chunkLabel(chunk: Chunk) {
  const similarity =
    typeof chunk.similarity === "number"
      ? ` similarity ${chunk.similarity.toFixed(2)}`
      : "";
  return `[doc ${chunk.document_id} chunk ${chunk.chunk_index}] ${chunk.text} risk ${chunk.injection_risk_score.toFixed(2)}${similarity}`;
}

function traceLabel(item: TraceItem) {
  return `${item.type} ${item.id}: ${item.reason}`;
}

function CachePanel({
  cache,
  onClear,
}: {
  cache: CacheList | null;
  onClear: () => void;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Semantic cache</h2>
        <button className="button" onClick={onClear}>
          Clear cache
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {cache?.entries.map((entry) => (
          <div
            className="rounded-md border border-line p-3 text-sm"
            key={entry.id}
          >
            <p className="font-semibold">{entry.model}</p>
            <p className="mt-1 text-ink/60">{entry.input_hash.slice(0, 16)}</p>
            <p className="mt-2 line-clamp-2">{entry.answer}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditPanel({
  apiKey,
  setApiKey,
  logs,
  notice,
  onLoad,
}: {
  apiKey: string;
  setApiKey: (value: string) => void;
  logs: AuditLog[];
  notice: string;
  onLoad: (event?: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold">Audit logs</h2>
      <form className="mt-4 flex flex-wrap gap-3" onSubmit={onLoad}>
        <input
          className="input max-w-md"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Owner/admin API key"
        />
        <button className="button">Load audit logs</button>
      </form>
      <p className="mt-3 text-sm text-ink/64">{notice}</p>
      <div className="mt-4 space-y-3">
        {logs.map((log) => (
          <div
            className="rounded-md border border-line bg-field p-3 text-sm"
            key={log.id}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{log.action}</span>
              <span className="text-xs text-ink/58">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/64">
              {log.resource_type} {log.resource_id ?? ""} role{" "}
              {log.actor_role ?? "unknown"}
            </p>
            <pre className="mt-2 overflow-auto rounded-md bg-white p-2 text-xs">
              {JSON.stringify(log.metadata_json, null, 2)}
            </pre>
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
          <div
            className="rounded-md border border-line bg-field p-3 text-sm leading-6"
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}
