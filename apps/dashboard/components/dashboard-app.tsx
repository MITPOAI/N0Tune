"use client";

import {
  Component,
  ErrorInfo,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  FlaskConical,
  Library,
  GitBranch,
  Network,
  Cpu,
  FileText,
  Plug,
  Database,
  ShieldCheck,
  ScrollText,
  Settings as SettingsIcon,
  Search,
  Bell,
  Terminal,
  RotateCw,
  ChevronDown,
  Brain,
  FolderKanban,
  BookOpen,
  Sliders,
  Plus,
  Download,
  Sparkles,
  MessageCircle,
  ListChecks,
  Activity,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { apiBaseUrl } from "../lib/config";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  SectionHeader,
  StatCard,
  StatusPill,
  TokenSavingsMeter,
} from "./design-system";

type Memory = {
  id: string;
  app_id: string;
  user_id: string;
  type: string;
  text: string;
  confidence: number;
  source_message_id: string | null;
  expires_at: string | null;
  state: string;
  scope: string;
  last_used_at: string | null;
  last_confirmed_at: string | null;
  version: number;
  replaced_by_memory_id: string | null;
  created_at: string;
  updated_at: string;
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
  app_id: string;
  title: string;
  source: string;
  metadata_json: Record<string, unknown>;
  content_hash: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
    context_hash: string;
    depends_on_json: Record<string, unknown>;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
};

type AuditLog = {
  id: string;
  app_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  created_at: string;
  metadata_json: Record<string, unknown>;
};

type ContextRun = {
  id: string;
  app_id: string;
  user_id: string;
  request_id: string;
  cache_hit: boolean;
  prompt_tokens_estimated: number;
  prompt_tokens_saved_estimated: number;
  selected_memories_json: Array<{ id: string; type?: string; text?: string }>;
  selected_chunks_json: Array<{ id: string }>;
  selected_style_json: Record<string, unknown>;
  context_trace_json: Record<string, unknown>;
  created_at: string;
};

type Project = {
  id: string;
  app_id: string;
  name: string;
  root_path_hash: string;
  git_remote_hash: string | null;
  fingerprint_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProjectDetectResult = {
  project_id: string;
  project_name: string;
  detected_root: string;
  status: "created" | "existing";
  config_path: string | null;
  fingerprint: Record<string, unknown>;
  project: Project;
};

type ProjectSession = {
  id: string;
  project_id: string;
  tool_name: string;
  tool_session_id: string | null;
  title: string;
  goal: string | null;
  status: string;
  model: string | null;
  context_tokens_estimated: number;
  context_pressure: string;
  files_touched_json: string[];
  commands_run_json: string[];
  memories_created_json: string[];
  docs_used_json: string[];
  summary: string | null;
  next_steps_json: string[];
  created_handoff_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type HandoffCapsule = {
  id: string;
  project_id: string;
  source_tool: string;
  target_tool: string | null;
  title: string;
  goal: string | null;
  current_state: string;
  decisions_json: string[];
  files_changed_json: string[];
  commands_run_json: string[];
  errors_seen_json: string[];
  tests_run_json: string[];
  next_steps_json: string[];
  open_questions_json: string[];
  warnings_json: string[];
  memory_refs_json: string[];
  doc_refs_json: string[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type ProjectContext = {
  project: Project;
  relevant_memories: Memory[];
  docs: DocumentItem[];
  handoffs: HandoffCapsule[];
  current_tasks: Memory[];
};

type Health = {
  status: string;
  dependencies?: Record<string, string>;
};

type FetchIssue = {
  scope: string;
  message: string;
};

type NavKey =
  | "command"
  | "context-lab"
  | "memory"
  | "sessions"
  | "handoff"
  | "models"
  | "files"
  | "mcp"
  | "cache"
  | "security"
  | "audit"
  | "settings";

type NavItem = {
  key: NavKey;
  label: string;
  short: string;
  status: "live" | "partial" | "planned";
  description: string;
  icon: LucideIcon;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Control",
    items: [
      {
        key: "command",
        label: "Command Center",
        short: "CC",
        status: "live",
        description: "Runtime health, memory, context, and next actions.",
        icon: LayoutDashboard,
      },
      {
        key: "context-lab",
        label: "Context Lab",
        short: "CL",
        status: "live",
        description: "Same question, different users, different context.",
        icon: FlaskConical,
      },
      {
        key: "memory",
        label: "Memory Library",
        short: "ML",
        status: "live",
        description: "Shelves, semantic search, and memory quality.",
        icon: Library,
      },
      {
        key: "sessions",
        label: "Sessions",
        short: "SE",
        status: "partial",
        description: "Context pressure and tool handoffs.",
        icon: GitBranch,
      },
      {
        key: "handoff",
        label: "Handoff",
        short: "HF",
        status: "live",
        description: "Project Handoff Capsules and continuation prompts.",
        icon: Network,
      },
    ],
  },
  {
    label: "Capabilities",
    items: [
      {
        key: "models",
        label: "Models",
        short: "MO",
        status: "live",
        description: "Live via env vars. In-dashboard key form planned.",
        icon: Cpu,
      },
      {
        key: "files",
        label: "Files",
        short: "FI",
        status: "live",
        description: "Index documents and inspect chunks.",
        icon: FileText,
      },
      {
        key: "mcp",
        label: "MCP & Plugins",
        short: "MP",
        status: "partial",
        description: "MCP server exists; dashboard setup flow is planned.",
        icon: Plug,
      },
      {
        key: "cache",
        label: "Cache",
        short: "CA",
        status: "live",
        description: "Semantic cache list and clear.",
        icon: Database,
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        key: "security",
        label: "Security",
        short: "SC",
        status: "live",
        description: "Secret checks, injection risk, scoped data.",
        icon: ShieldCheck,
      },
      {
        key: "audit",
        label: "Audit Logs",
        short: "AL",
        status: "live",
        description: "Admin or owner API key required.",
        icon: ScrollText,
      },
      {
        key: "settings",
        label: "Settings",
        short: "ST",
        status: "live",
        description: "Workspace, companion, theme, deployment.",
        icon: SettingsIcon,
      },
    ],
  },
];

const DEFAULT_APP_ID = "demo";
const DEFAULT_USER_ID = "n0tune_builder";
const LAB_DOC_TITLE = "Context Lab RAG note";
const LAB_DOC_CONTENT =
  "RAG retrieves external documents. N0Tune combines RAG with personal memory, response style, local files, semantic cache, and a compact context compiler. The same model can receive different context for different users without fine-tuning.";

function readStorage(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function writeStorage(key: string, value: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringifyErrorBody(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

class AppShellErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: errorMessage(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("N0Tune dashboard render failed", error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return (
        <ErrorState
          title="Dashboard render failed"
          body={`${this.state.message}. Refresh the page after fixing the underlying state.`}
        />
      );
    }
    return this.props.children;
  }
}

function FetchIssueList({
  issues,
  onDismiss,
}: {
  issues: FetchIssue[];
  onDismiss: (scope: string) => void;
}) {
  if (!issues.length) return null;
  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div className="relative" key={issue.scope}>
          <ErrorState title={`${issue.scope} failed`} body={issue.message} />
          <button
            aria-label={`Dismiss ${issue.scope} error`}
            className="absolute right-3 top-3 text-xs font-semibold text-danger underline-offset-2 hover:underline"
            onClick={() => onDismiss(issue.scope)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}

export function DashboardApp() {
  const [active, setActive] = useState<NavKey>("command");
  const [appId, setAppIdState] = useState(() =>
    typeof window === "undefined"
      ? DEFAULT_APP_ID
      : window.localStorage.getItem("n0tune.appId") ?? DEFAULT_APP_ID,
  );
  const [userId, setUserIdState] = useState(() =>
    typeof window === "undefined"
      ? DEFAULT_USER_ID
      : window.localStorage.getItem("n0tune.userId") ?? DEFAULT_USER_ID,
  );
  const [health, setHealth] = useState<Health | null>(null);
  const [notice, setNotice] = useState("");
  const [fetchIssues, setFetchIssues] = useState<FetchIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [style, setStyle] = useState<StyleProfile | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [cache, setCache] = useState<CacheList | null>(null);
  const [contextRuns, setContextRuns] = useState<ContextRun[]>([]);
  const [preview, setPreview] = useState<ContextPreview | null>(null);
  const [currentProject, setCurrentProject] =
    useState<ProjectDetectResult | null>(null);
  const [projectContext, setProjectContext] =
    useState<ProjectContext | null>(null);
  const [projectSessions, setProjectSessions] = useState<ProjectSession[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffCapsule[]>([]);
  const [handoffPrompt, setHandoffPrompt] = useState("");

  const [message, setMessage] = useState("What is RAG?");
  const [labUserA, setLabUserA] = useState("context_lab_user_a");
  const [labUserB, setLabUserB] = useState("context_lab_user_b");
  const [labQuestion, setLabQuestion] = useState("What is RAG?");
  const [labPreviewA, setLabPreviewA] = useState<ContextPreview | null>(null);
  const [labPreviewB, setLabPreviewB] = useState<ContextPreview | null>(null);
  const [labNotice, setLabNotice] = useState(
    "Preview only - no model call. Context Lab calls /v1/context/preview.",
  );
  const [labRunning, setLabRunning] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditKey, setAuditKey] = useState("");
  const [auditNotice, setAuditNotice] = useState(
    "Audit logs require an owner or admin API key.",
  );

  const [memorySearchResults, setMemorySearchResults] = useState<
    Memory[] | null
  >(null);
  const [memorySearchQuery, setMemorySearchQuery] = useState("");
  const [memorySearchRunning, setMemorySearchRunning] = useState(false);

  const [companionName, setCompanionNameState] = useState("N0va");
  const [companionAvatar, setCompanionAvatarState] = useState<string | null>(
    null,
  );
  const [companionNotice, setCompanionNotice] = useState("");

  useEffect(() => {
    const storedName = readStorage("n0tune.companion.name", "");
    const storedAvatar = readStorage("n0tune.companion.avatar", "");
    if (storedName) setCompanionNameState(storedName);
    if (storedAvatar) setCompanionAvatarState(storedAvatar);
  }, []);

  const setCompanionName = useCallback((value: string) => {
    const next = value.trim().slice(0, 32) || "N0va";
    setCompanionNameState(next);
    writeStorage("n0tune.companion.name", next);
  }, []);

  const setCompanionAvatar = useCallback((dataUrl: string | null) => {
    setCompanionAvatarState(dataUrl);
    if (typeof window === "undefined") return;
    if (dataUrl) window.localStorage.setItem("n0tune.companion.avatar", dataUrl);
    else window.localStorage.removeItem("n0tune.companion.avatar");
  }, []);

  const handleCompanionAvatarFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.size > 1024 * 1024) {
        setCompanionNotice(
          `Avatar too large (${Math.round(file.size / 1024)} kB). Pick something under 1 MB.`,
        );
        return;
      }
      if (!file.type.startsWith("image/")) {
        setCompanionNotice("Pick a PNG / JPG / SVG / WebP image.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setCompanionAvatar(reader.result);
          setCompanionNotice(
            `Avatar updated · ${Math.round(file.size / 1024)} kB ${file.type}`,
          );
        }
      };
      reader.onerror = () => setCompanionNotice("Could not read the file.");
      reader.readAsDataURL(file);
    },
    [setCompanionAvatar],
  );

  const baseUrl = useMemo(() => apiBaseUrl.replace(/\/$/, ""), []);
  const selectedNav = useMemo(() => {
    return NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.key === active,
    );
  }, [active]);

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isPaletteShortcut) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setAppId = useCallback((value: string) => {
    setAppIdState(value);
    writeStorage("n0tune.appId", value);
  }, []);

  const setUserId = useCallback((value: string) => {
    setUserIdState(value);
    writeStorage("n0tune.userId", value);
  }, []);

  const clearIssue = useCallback((scope: string) => {
    setFetchIssues((issues) =>
      issues.filter((issue) => issue.scope !== scope),
    );
  }, []);

  const reportIssue = useCallback((scope: string, error: unknown) => {
    setFetchIssues((issues) => [
      ...issues.filter((issue) => issue.scope !== scope),
      { scope, message: errorMessage(error) },
    ]);
  }, []);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const body = await parseResponseBody<T>(response);
      if (!response.ok) {
        const detail = stringifyErrorBody(body);
        throw new Error(
          `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
        );
      }
      return body;
    },
    [baseUrl],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const calls = [
      {
        scope: "Gateway health",
        run: () => request<Health>("/health?deep=true"),
        apply: (body: Health) => setHealth(body),
      },
      {
        scope: "Memory list",
        run: () =>
          request<Memory[]>(
            `/v1/memories?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}&limit=200`,
          ),
        apply: (body: Memory[]) => setMemories(body),
      },
      {
        scope: "Style profile",
        run: () =>
          request<StyleProfile>(
            `/v1/users/${encodeURIComponent(userId)}/style?app_id=${encodeURIComponent(appId)}`,
          ),
        apply: (body: StyleProfile) => setStyle(body),
      },
      {
        scope: "Document list",
        run: () =>
          request<DocumentItem[]>(
            `/v1/documents?app_id=${encodeURIComponent(appId)}`,
          ),
        apply: (body: DocumentItem[]) => setDocuments(body),
      },
      {
        scope: "Cache list",
        run: () =>
          request<CacheList>(
            `/v1/cache?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
          ),
        apply: (body: CacheList) => setCache(body),
      },
      {
        scope: "Context runs",
        run: () =>
          request<ContextRun[]>(
            `/v1/context-runs?app_id=${encodeURIComponent(appId)}&limit=50`,
          ),
        apply: (body: ContextRun[]) => setContextRuns(body),
      },
    ] as const;

    const results = await Promise.allSettled(
      calls.map(async (call) => ({
        scope: call.scope,
        body: await call.run(),
      })),
    );

    const issues: FetchIssue[] = [];
    results.forEach((result, index) => {
      const call = calls[index];
      if (result.status === "fulfilled") {
        call.apply(result.value.body as never);
      } else {
        issues.push({
          scope: call.scope,
          message: errorMessage(result.reason),
        });
        if (call.scope === "Gateway health") {
          setHealth({ status: "error" });
        }
      }
    });

    setFetchIssues((current) => [
      ...current.filter(
        (issue) => !calls.some((call) => call.scope === issue.scope),
      ),
      ...issues,
    ]);

    try {
      const detected = await request<ProjectDetectResult>("/v1/projects/detect", {
        method: "POST",
        body: JSON.stringify({
          app_id: appId,
          cwd: ".",
          tool_name: "dashboard",
        }),
      });
      setCurrentProject(detected);
      const [context, sessions, latestHandoffs] = await Promise.all([
        request<ProjectContext>(
          `/v1/projects/${encodeURIComponent(detected.project_id)}/context?app_id=${encodeURIComponent(appId)}`,
        ),
        request<ProjectSession[]>(
          `/v1/projects/${encodeURIComponent(detected.project_id)}/sessions?app_id=${encodeURIComponent(appId)}`,
        ),
        request<HandoffCapsule[]>(
          `/v1/projects/${encodeURIComponent(detected.project_id)}/handoffs?app_id=${encodeURIComponent(appId)}&limit=10`,
        ),
      ]);
      setProjectContext(context);
      setProjectSessions(sessions);
      setHandoffs(latestHandoffs);
      clearIssue("Project context");
    } catch (error) {
      setCurrentProject(null);
      setProjectContext(null);
      setProjectSessions([]);
      setHandoffs([]);
      reportIssue("Project context", error);
    }
    setNotice("");
    setLoading(false);
  }, [appId, clearIssue, reportIssue, request, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request<Memory>("/v1/memories", {
        method: "POST",
        body: JSON.stringify({
          app_id: appId,
          user_id: userId,
          type: form.get("type"),
          text: form.get("text"),
          confidence: Number(form.get("confidence")),
          scope: form.get("scope") || "user",
        }),
      });
      clearIssue("Save memory");
      formElement.reset();
      await refresh();
    } catch (error) {
      reportIssue("Save memory", error);
    }
  }

  async function deleteMemory(memoryId: string) {
    try {
      await request(
        `/v1/memories/${encodeURIComponent(memoryId)}?app_id=${encodeURIComponent(appId)}`,
        { method: "DELETE" },
      );
      clearIssue("Delete memory");
      await refresh();
    } catch (error) {
      reportIssue("Delete memory", error);
    }
  }

  async function editMemory(memoryId: string, nextText: string) {
    try {
      await request<Memory>(`/v1/memories/${encodeURIComponent(memoryId)}`, {
        method: "PATCH",
        body: JSON.stringify({ app_id: appId, text: nextText }),
      });
      clearIssue("Edit memory");
      await refresh();
    } catch (error) {
      reportIssue("Edit memory", error);
    }
  }

  async function confirmMemory(memoryId: string) {
    try {
      await request(
        `/v1/memories/${encodeURIComponent(memoryId)}/confirm?app_id=${encodeURIComponent(appId)}`,
        { method: "POST" },
      );
      clearIssue("Confirm memory");
      await refresh();
    } catch (error) {
      reportIssue("Confirm memory", error);
    }
  }

  async function updateStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request<StyleProfile>(
        `/v1/users/${encodeURIComponent(userId)}/style`,
        {
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
        },
      );
      clearIssue("Update style profile");
      await refresh();
    } catch (error) {
      reportIssue("Update style profile", error);
    }
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request<DocumentItem>("/v1/documents", {
        method: "POST",
        body: JSON.stringify({
          app_id: appId,
          title: form.get("title"),
          source: form.get("source") || "dashboard",
          content: form.get("content"),
          metadata_json: currentProject
            ? { project_id: currentProject.project_id }
            : {},
        }),
      });
      clearIssue("Index document");
      formElement.reset();
      await refresh();
    } catch (error) {
      reportIssue("Index document", error);
    }
  }

  async function previewContext(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    try {
      const body = await request<ContextPreview>("/v1/context/preview", {
        method: "POST",
        body: JSON.stringify({
          app_id: appId,
          user_id: userId,
          project_id: currentProject?.project_id,
          message,
          max_context_tokens: 1200,
        }),
      });
      setPreview(body);
      clearIssue("Context preview");
      await refresh();
    } catch (error) {
      reportIssue("Context preview", error);
    }
  }

  async function clearCache() {
    try {
      await request(
        `/v1/cache?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      clearIssue("Clear cache");
      await refresh();
    } catch (error) {
      reportIssue("Clear cache", error);
    }
  }

  async function searchMemories(query: string) {
    const term = query.trim();
    if (!term) {
      setMemorySearchResults(null);
      setMemorySearchQuery("");
      return;
    }
    setMemorySearchRunning(true);
    setMemorySearchQuery(term);
    try {
      const results = await request<Memory[]>(
        `/v1/memories?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}&q=${encodeURIComponent(term)}&limit=50`,
      );
      setMemorySearchResults(results);
      clearIssue("Memory search");
    } catch (error) {
      reportIssue("Memory search", error);
      setMemorySearchResults([]);
    } finally {
      setMemorySearchRunning(false);
    }
  }

  function clearMemorySearch() {
    setMemorySearchResults(null);
    setMemorySearchQuery("");
  }

  async function loadAuditLogs(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!auditKey.trim()) {
      setAuditNotice("Enter an owner/admin API key to load audit logs.");
      return;
    }
    try {
      const logs = await request<AuditLog[]>(
        `/v1/audit-logs?app_id=${encodeURIComponent(appId)}&limit=50`,
        { headers: { "X-N0Tune-API-Key": auditKey } },
      );
      setAuditLogs(logs);
      setAuditNotice(`${logs.length} audit log entries loaded.`);
      clearIssue("Audit logs");
    } catch (error) {
      setAuditNotice(
        error instanceof Error ? error.message : "Unable to load audit logs.",
      );
      reportIssue("Audit logs", error);
    }
  }

  async function seedContextLab() {
    setLabRunning(true);
    setLabNotice("Creating or selecting User A and User B context...");
    try {
      await Promise.all([
        ensureMemory(
          labUserA,
          "style",
          "When explaining RAG, User A prefers short technical bullets, direct tradeoffs, and code examples.",
        ),
        ensureMemory(
          labUserB,
          "style",
          "When explaining RAG, User B prefers beginner explanations, simple analogies, and diagram-like steps.",
        ),
        updateUserStyle(labUserA, {
          tone: "direct",
          depth: "medium",
          format: "short technical bullets + code examples",
          avoid: ["hype", "long theory"],
        }),
        updateUserStyle(labUserB, {
          tone: "friendly",
          depth: "high",
          format: "analogy + simple diagram + steps",
          avoid: ["terse answers"],
        }),
        ensureLabDocument(),
      ]);
      await runContextLab();
      setLabNotice(
        "Context Lab seeded and previewed. Preview only - no model call.",
      );
      clearIssue("Context Lab seed");
    } catch (error) {
      setLabNotice(
        error instanceof Error ? error.message : "Context Lab setup failed.",
      );
      reportIssue("Context Lab seed", error);
    } finally {
      setLabRunning(false);
      await refresh();
    }
  }

  async function runContextLab(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLabRunning(true);
    setLabNotice("Calling /v1/context/preview for both users.");
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
      clearIssue("Context Lab preview");
    } catch (error) {
      setLabNotice(
        error instanceof Error ? error.message : "Context Lab preview failed.",
      );
      reportIssue("Context Lab preview", error);
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
    if (existing.some((memory) => memory.text === text)) return;
    await request<Memory>("/v1/memories", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: targetUserId,
        type,
        text,
        confidence: 1,
        scope: "user",
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
        body: JSON.stringify({ app_id: appId, profile_json: profile }),
      },
    );
  }

  async function ensureLabDocument() {
    const docs = await request<DocumentItem[]>(
      `/v1/documents?app_id=${encodeURIComponent(appId)}`,
    );
    if (docs.some((doc) => doc.title === LAB_DOC_TITLE)) return;
    await request<DocumentItem>("/v1/documents", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        title: LAB_DOC_TITLE,
        source: "context-lab",
        content: LAB_DOC_CONTENT,
      }),
    });
  }

  function contextPreviewFor(targetUserId: string, question: string) {
    return request<ContextPreview>("/v1/context/preview", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        user_id: targetUserId,
        message: question,
        max_context_tokens: 1200,
      }),
    });
  }

  async function loadContinuationPrompt(handoffId: string, targetTool = "codex") {
    try {
      const body = await request<{ continuation_prompt: string }>(
        `/v1/handoffs/${encodeURIComponent(handoffId)}/continue-prompt`,
        {
          method: "POST",
          body: JSON.stringify({ app_id: appId, target_tool: targetTool }),
        },
      );
      setHandoffPrompt(body.continuation_prompt);
      clearIssue("Handoff continue prompt");
    } catch (error) {
      reportIssue("Handoff continue prompt", error);
    }
  }

  function renderPage() {
    if (active === "command") {
      return (
        <CommandCenter
          loading={loading}
          health={health}
          memories={memories}
          documents={documents}
          cache={cache}
          contextRuns={contextRuns}
          preview={preview}
          currentProject={currentProject}
          projectContext={projectContext}
          handoffs={handoffs}
          message={message}
          setMessage={setMessage}
          onPreview={previewContext}
          onNavigate={setActive}
          companionName={companionName}
          companionAvatar={companionAvatar}
        />
      );
    }
    if (active === "context-lab") {
      return (
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
          onSeed={seedContextLab}
          onRun={runContextLab}
        />
      );
    }
    if (active === "memory") {
      return (
        <MemoryLibrary
          memories={memories}
          style={style}
          searchResults={memorySearchResults}
          searchQuery={memorySearchQuery}
          searchRunning={memorySearchRunning}
          onSearch={searchMemories}
          onClearSearch={clearMemorySearch}
          onCreate={createMemory}
          onDelete={deleteMemory}
          onConfirm={confirmMemory}
          onEdit={editMemory}
          onUpdateStyle={updateStyle}
        />
      );
    }
    if (active === "files") {
      return <FilesPage documents={documents} onCreate={createDocument} />;
    }
    if (active === "cache") {
      return (
        <CachePage cache={cache} runs={contextRuns} onClear={clearCache} />
      );
    }
    if (active === "security") {
      return <SecurityPage documents={documents} preview={preview} />;
    }
    if (active === "audit") {
      return (
        <AuditPage
          apiKey={auditKey}
          setApiKey={setAuditKey}
          logs={auditLogs}
          notice={auditNotice}
          onLoad={loadAuditLogs}
        />
      );
    }
    if (active === "mcp") return <McpPage appId={appId} userId={userId} />;
    if (active === "sessions")
      return (
        <SessionsPage
          runs={contextRuns}
          sessions={projectSessions}
          onCreateHandoff={() => setActive("handoff")}
        />
      );
    if (active === "handoff")
      return (
        <HandoffPage
          currentProject={currentProject}
          handoffs={handoffs}
          continuationPrompt={handoffPrompt}
          onContinue={loadContinuationPrompt}
        />
      );
    if (active === "models") return <ModelsPage />;
    return (
      <SettingsPage
        appId={appId}
        userId={userId}
        companionName={companionName}
        companionAvatar={companionAvatar}
        companionNotice={companionNotice}
        onCompanionName={setCompanionName}
        onCompanionAvatar={setCompanionAvatar}
        onCompanionAvatarFile={handleCompanionAvatarFile}
      />
    );
  }

  return (
    <AppShell
      active={active}
      selectedNav={selectedNav}
      appId={appId}
      userId={userId}
      health={health}
      memories={memories}
      documents={documents}
      cache={cache}
      onNav={setActive}
      onAppId={setAppId}
      onUserId={setUserId}
      onRefresh={refresh}
      onOpenPalette={() => setPaletteOpen(true)}
    >
      <FetchIssueList issues={fetchIssues} onDismiss={clearIssue} />
      {notice ? <ErrorState body={notice} /> : null}
      {renderPage()}
      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={(key) => {
            setActive(key);
            setPaletteOpen(false);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function AppShell({
  active,
  selectedNav,
  appId,
  userId,
  health,
  memories,
  documents,
  cache,
  children,
  onNav,
  onAppId,
  onUserId,
  onRefresh,
  onOpenPalette,
}: {
  active: NavKey;
  selectedNav?: NavItem;
  appId: string;
  userId: string;
  health: Health | null;
  memories: Memory[];
  documents: DocumentItem[];
  cache: CacheList | null;
  children: ReactNode;
  onNav: (key: NavKey) => void;
  onAppId: (value: string) => void;
  onUserId: (value: string) => void;
  onRefresh: () => void;
  onOpenPalette: () => void;
}) {
  const statusTone = health?.status === "ok" ? "success" : "warning";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const allNavItems = useMemo(
    () => NAV_GROUPS.flatMap((group) => group.items),
    [],
  );
  const mobileNavItems = useMemo(
    () =>
      allNavItems.filter((item) =>
        ["command", "context-lab", "memory", "settings"].includes(item.key),
      ),
    [allNavItems],
  );
  const handleNav = useCallback(
    (key: NavKey) => {
      onNav(key);
      setMobileNavOpen(false);
    },
    [onNav],
  );

  return (
    <div className="app-shell">
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="mobile-nav-scrim"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`shell-sidebar ${mobileNavOpen ? "shell-sidebar--open" : ""}`}
      >
        <div className="mobile-drawer-header">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ice-muted">
              Navigation
            </p>
            <p className="truncate text-sm font-semibold text-ice">
              {selectedNav?.label ?? "Command Center"}
            </p>
          </div>
          <button
            aria-label="Close navigation"
            className="topbar-icon h-11 w-11 justify-center p-0"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="N0Tune"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg border border-glass-line bg-white/8 object-contain p-1"
            />
            <div>
              <p className="text-lg font-semibold tracking-tight text-ice">
                N0Tune
              </p>
              <p className="text-xs text-ice-muted">Project Context Runtime</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-memory/25 bg-memory/10 p-3">
            <p className="text-sm font-semibold text-ice">
              Keep context across AI tools.
            </p>
            <p className="mt-2 text-xs leading-5 text-ice-muted">
              N0Tune carries project decisions, memories, and handoffs from one
              session to the next.
            </p>
          </div>
        </div>

        <nav className="space-y-5 px-3 pb-5" aria-label="Dashboard">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ice-muted">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      aria-current={active === item.key ? "page" : undefined}
                      className="nav-button"
                      key={item.key}
                      onClick={() => handleNav(item.key)}
                      type="button"
                      title={`${item.label} · ${item.description}`}
                    >
                      <span className="nav-mark">
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-ice-muted">
                          {item.description}
                        </span>
                      </span>
                      <StatusDot status={item.status} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-glass-line p-4 text-xs text-ice-muted">
          <div className="flex items-center gap-2 rounded-lg border border-glass-line bg-white/[0.04] p-2">
            <Terminal size={16} strokeWidth={1.8} className="text-memory" />
            <div className="min-w-0">
              <p className="font-mono text-ice">N0Tune CLI</p>
              <p className="text-[11px] text-ice-muted">
                v0.1.6 ·{" "}
                <span className="text-success">Up to date</span>
              </p>
            </div>
          </div>
          <a
            className="mt-3 flex items-center gap-2 rounded-lg border border-glass-line bg-white/[0.04] p-2 hover:border-memory/35"
            href="https://github.com/MITPOAI/N0Tune"
            rel="noreferrer"
            target="_blank"
          >
            <svg
              aria-hidden="true"
              fill="currentColor"
              height="16"
              viewBox="0 0 16 16"
              width="16"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.82 1.23.82.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="text-ice">View on GitHub</span>
          </a>
          <p className="mt-2 leading-5">
            Open source · MIT · No telemetry
          </p>
        </div>
      </aside>

      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-current={active === item.key ? "page" : undefined}
              className="mobile-tabbar__button"
              key={item.key}
              onClick={() => handleNav(item.key)}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="mobile-tabbar__label">{item.short}</span>
            </button>
          );
        })}
        <button
          aria-expanded={mobileNavOpen}
          aria-haspopup="dialog"
          className="mobile-tabbar__button"
          onClick={() => setMobileNavOpen(true)}
          type="button"
        >
          <Menu size={18} strokeWidth={1.8} />
          <span className="mobile-tabbar__label">More</span>
        </button>
      </nav>

      <main className="shell-main">
        <header className="shell-topbar">
          <div className="min-w-0">
            <p className="text-sm text-ice-muted">
              Same project.{" "}
              <span className="font-semibold text-ice">Same memory.</span> Any
              AI tool.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusPill tone={statusTone} dot>
              {health?.status === "ok" ? "Project Runtime Online" : "Checking"}
            </StatusPill>
            <DeploymentPill />
            <button
              aria-label="Refresh"
              className="topbar-icon"
              onClick={onRefresh}
              title="Refresh · re-fetch dashboard data"
              type="button"
            >
              <RotateCw size={16} strokeWidth={1.8} />
              <span className="hidden md:inline">Sync</span>
            </button>
            <button
              aria-label="Open command palette"
              className="topbar-icon"
              onClick={onOpenPalette}
              title="Command palette · ⌘K"
              type="button"
            >
              <Search size={16} strokeWidth={1.8} />
              <span className="hidden md:inline">⌘K</span>
            </button>
            <a
              aria-label="Open API docs"
              className="topbar-icon"
              href="http://localhost:8000/docs"
              rel="noreferrer"
              target="_blank"
              title="Open Gateway API docs (/docs)"
            >
              <Terminal size={16} strokeWidth={1.8} />
            </a>
            <button
              aria-label="Notifications (planned)"
              className="topbar-icon relative"
              onClick={onOpenPalette}
              title="Notifications - planned, opens palette for now"
              type="button"
            >
              <Bell size={16} strokeWidth={1.8} />
              <span className="topbar-badge">3</span>
            </button>
            <span
              aria-label={`Workspace ${appId} · ${userId}`}
              className="topbar-avatar"
              title={`${userId} (${appId})`}
            >
              <span className="text-xs font-semibold">
                {(userId.split(/[^a-zA-Z0-9]/).filter(Boolean)[0] ?? "AV")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <ChevronDown size={12} strokeWidth={2} />
            </span>
          </div>
        </header>

        <div className="mx-auto mt-3 flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {selectedNav ? (
                <StatusPill tone={statusToneForNav(selectedNav.status)}>
                  {selectedNav.status}
                </StatusPill>
              ) : null}
              <StatusPill tone="neutral">
                {memories.length} memories
              </StatusPill>
              <StatusPill tone="neutral">{documents.length} docs</StatusPill>
              <StatusPill tone="neutral">
                {cache?.total ?? 0} cached
              </StatusPill>
            </div>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-ice">
              {selectedNav?.label ?? "Command Center"}
            </h1>
            {selectedNav?.description ? (
              <p className="mt-1 text-sm text-ice-muted">
                {selectedNav.description}
              </p>
            ) : null}
          </div>

          {/* Workspace identity strip — compact controls so Playwright + power
              users always have access without opening the avatar popover. */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-ice-muted">
              App ID
              <input
                aria-label="App ID"
                className="input mt-1 h-9 min-w-[140px] text-sm"
                onChange={(event) => onAppId(event.target.value)}
                value={appId}
              />
            </label>
            <label className="text-xs font-semibold text-ice-muted">
              User ID
              <input
                aria-label="User ID"
                className="input mt-1 h-9 min-w-[160px] text-sm"
                onChange={(event) => onUserId(event.target.value)}
                value={userId}
              />
            </label>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] space-y-6">
          <AppShellErrorBoundary>{children}</AppShellErrorBoundary>
        </div>

        <footer className="mt-10 border-t border-glass-line pt-4 text-xs text-ice-muted">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <a
                className="hover:text-ice"
                href="https://github.com/MITPOAI/N0Tune#readme"
                rel="noreferrer"
                target="_blank"
              >
                Docs
              </a>
              <a
                className="hover:text-ice"
                href="https://github.com/MITPOAI/N0Tune/blob/main/docs/product-direction.md"
                rel="noreferrer"
                target="_blank"
              >
                Roadmap
              </a>
              <a
                className="hover:text-ice"
                href="https://github.com/MITPOAI/N0Tune/blob/main/CONTRIBUTING.md"
                rel="noreferrer"
                target="_blank"
              >
                Contribute
              </a>
              <span className="font-mono">
                runtime: {apiBaseUrl.replace(/^https?:\/\//, "")}
              </span>
            </div>
            <StatusPill tone={statusTone} dot>
              {health?.status === "ok" ? "system healthy" : "checking gateway"}
            </StatusPill>
          </div>
        </footer>
      </main>
    </div>
  );
}

function DeploymentDetail() {
  const mode = useMemo(() => detectDeploymentMode(apiBaseUrl), []);
  const tone: "success" | "info" | "neutral" =
    mode.kind === "local"
      ? "success"
      : mode.kind === "self-hosted"
        ? "info"
        : "neutral";
  const dockerCompose = "docker compose up -d --wait";
  const sqliteFallback = `cd apps/api
N0TUNE_DATABASE_URL="sqlite+pysqlite:///./n0tune.db" \\
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={tone} dot>
          {mode.label}
        </StatusPill>
        <span className="font-mono text-xs text-ice-muted">{apiBaseUrl}</span>
      </div>
      <p className="text-sm leading-6 text-ice-muted">{mode.body}</p>

      <div>
        <p className="label-text">Recommended: docker compose</p>
        <div className="copy-block mt-2">
          <button
            className="copy-button"
            onClick={() => copyToClipboard(dockerCompose)}
            type="button"
          >
            Copy
          </button>
          <pre>{dockerCompose}</pre>
        </div>
        <p className="mt-2 text-xs text-ice-muted">
          Boots postgres (pgvector), redis, api, and dashboard. The Gateway
          listens on <span className="font-mono">http://localhost:8000</span>.
        </p>
      </div>

      <div>
        <p className="label-text">No-docker fallback (sqlite)</p>
        <div className="copy-block mt-2">
          <button
            className="copy-button"
            onClick={() => copyToClipboard(sqliteFallback)}
            type="button"
          >
            Copy
          </button>
          <pre>{sqliteFallback}</pre>
        </div>
        <p className="mt-2 text-xs text-ice-muted">
          Local SQLite for laptop / Desktop dev. Same schema, no Docker.
        </p>
      </div>

      <p className="text-xs text-ice-muted">
        Open source under MIT. Zero telemetry. Memories stay on the Gateway
        you control.
      </p>
    </div>
  );
}

function DeploymentPill() {
  const mode = useMemo(() => detectDeploymentMode(apiBaseUrl), []);
  const tone: "success" | "info" | "neutral" =
    mode.kind === "local"
      ? "success"
      : mode.kind === "self-hosted"
        ? "info"
        : "neutral";
  return (
    <StatusPill tone={tone} dot>
      {mode.label}
    </StatusPill>
  );
}

function detectDeploymentMode(baseUrl: string): {
  kind: "local" | "self-hosted" | "custom";
  label: string;
  body: string;
} {
  let host = "";
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    host = baseUrl;
  }
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local")
  ) {
    return {
      kind: "local",
      label: "Local",
      body: "Gateway is running on your own machine. No data leaves it.",
    };
  }
  if (
    host === "n0tune-api" ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    return {
      kind: "self-hosted",
      label: "Self-hosted",
      body: "Pointing at an internal/self-hosted Gateway. You own the box.",
    };
  }
  return {
    kind: "custom",
    label: "Custom endpoint",
    body: `Pointing at ${host}. Verify the endpoint is one you trust.`,
  };
}

function CommandPalette({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (key: NavKey) => void;
}) {
  const [filter, setFilter] = useState("");
  const items = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.label })),
      ),
    [],
  );
  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.group.toLowerCase().includes(term),
    );
  }, [filter, items]);

  return (
    <div
      aria-modal="true"
      className="palette-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="palette-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          aria-label="Search pages"
          autoFocus
          className="input"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Jump to page, e.g. memory, sessions, cache"
          value={filter}
        />
        <div className="mt-3 max-h-[60vh] overflow-auto">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                className="palette-item"
                key={item.key}
                onClick={() => onNavigate(item.key)}
                type="button"
              >
                <span className="nav-mark">{item.short}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ice">
                    {item.label}
                  </span>
                  <span className="block text-xs text-ice-muted">
                    {item.group} · {item.description}
                  </span>
                </span>
                <StatusDot status={item.status} />
              </button>
            ))
          ) : (
            <p className="p-4 text-sm text-ice-muted">
              No pages match. Try &quot;memory&quot;, &quot;handoff&quot;, or
              &quot;mcp&quot;.
            </p>
          )}
        </div>
        <div className="mt-3 flex justify-between text-xs text-ice-muted">
          <span>
            Tip: notifications and palette shortcuts (⌘K) are wired to actions
            but global hotkey is desktop-only.
          </span>
          <button
            className="text-ice underline-offset-2 hover:underline"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandCenter({
  loading,
  health,
  memories,
  documents,
  cache,
  contextRuns,
  preview,
  currentProject,
  projectContext,
  handoffs,
  message,
  setMessage,
  onPreview,
  onNavigate,
  companionName,
  companionAvatar,
}: {
  loading: boolean;
  health: Health | null;
  memories: Memory[];
  documents: DocumentItem[];
  cache: CacheList | null;
  contextRuns: ContextRun[];
  preview: ContextPreview | null;
  currentProject: ProjectDetectResult | null;
  projectContext: ProjectContext | null;
  handoffs: HandoffCapsule[];
  message: string;
  setMessage: (value: string) => void;
  onPreview: (event?: FormEvent<HTMLFormElement>) => void;
  onNavigate: (key: NavKey) => void;
  companionName: string;
  companionAvatar: string | null;
}) {
  const stats = useMemo(() => memoryStats(memories), [memories]);
  const latestRun = contextRuns[0];
  const compiled =
    preview?.prompt_tokens_estimated ?? latestRun?.prompt_tokens_estimated ?? 0;
  const saved =
    preview?.tokens_saved_estimated ??
    latestRun?.prompt_tokens_saved_estimated ??
    0;
  const mood = useMemo(
    () => companionMood(health, memories, documents, preview),
    [health, memories, documents, preview],
  );
  const ctxHealth = useMemo(
    () =>
      contextHealthBreakdown(
        health,
        memories,
        documents,
        contextRuns,
        preview,
      ),
    [health, memories, documents, contextRuns, preview],
  );
  const savingsAgg = useMemo(() => aggregateRuns(contextRuns), [contextRuns]);

  return (
    <div className="space-y-6">
      {/* Hero action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ice">
            Same project. Same memory. Any AI tool.
          </h1>
          <p className="mt-1 text-sm text-ice-muted">
            {currentProject
              ? `N0Tune is tracking ${currentProject.project_name}. Latest handoffs: ${handoffs.length}.`
              : "N0Tune is waiting for project detection from the local Gateway."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button button-secondary"
            onClick={() => onNavigate("files")}
            type="button"
          >
            <Download size={16} strokeWidth={1.8} />
            Import Context Bundle
          </button>
          <button
            className="button"
            onClick={() => onNavigate("context-lab")}
            type="button"
          >
            <Plus size={16} strokeWidth={1.8} />
            Project Context
          </button>
        </div>
      </div>

      {/* Row 1: Companion · Context Health · Current Model */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Current project"
          value={currentProject?.project_name ?? "Not detected"}
          detail={currentProject?.detected_root ?? "Gateway project detection pending"}
          tone={currentProject ? "success" : "warning"}
        />
        <StatCard
          label="Project memories"
          value={String(projectContext?.relevant_memories.length ?? 0)}
          detail="Scoped to this project id"
          tone="info"
        />
        <StatCard
          label="Handoff capsules"
          value={String(handoffs.length)}
          detail="Available through CLI and MCP"
          tone={handoffs.length ? "success" : "neutral"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <CompanionCard
          name={companionName}
          avatar={companionAvatar}
          mood={mood}
          onChat={() => onNavigate("context-lab")}
          onSettings={() => onNavigate("settings")}
        />
        <ContextHealthCard breakdown={ctxHealth} preview={preview} />
        <ModelRoutingCard onManage={() => onNavigate("models")} />
      </section>

      {/* Row 2: Memory Library card, Context Efficiency, Security Status */}
      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <MemoryLibraryCard
          memories={memories}
          stats={stats}
          onView={() => onNavigate("memory")}
        />
        <TokenSavingsCard
          savingsAgg={savingsAgg}
          contextRuns={contextRuns}
          onView={() => onNavigate("sessions")}
        />
        <SecurityStatusCard
          documents={documents}
          preview={preview}
          health={health}
          onOpen={() => onNavigate("security")}
        />
      </section>

      {/* Row 3: Recent Sessions (2 col span) · Quick Actions */}
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <RecentSessionsCard
          runs={contextRuns}
          onViewAll={() => onNavigate("sessions")}
          onEnter={() => onNavigate("sessions")}
        />
        <QuickActionsCard
          onNavigate={onNavigate}
          loading={loading}
        />
      </section>

      {/* Quick context preview kept for power users (E2E test selector) */}
      <GlassCard className="p-5">
        <SectionHeader
          title="Quick context preview"
          body="Calls /v1/context/preview only. Same compiler the MCP server uses."
        />
        <form
          className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]"
          onSubmit={onPreview}
        >
          <textarea
            aria-label="Context preview message"
            className="input min-h-24 resize-y"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button className="button self-end">Compile context</button>
        </form>
        {preview ? (
          <div className="mt-4">
            <ContextPreviewPanel
              label="Current user"
              userId="selected topbar user"
              preview={preview}
            />
          </div>
        ) : null}
      </GlassCard>

      <CompanionBadges
        memories={memories}
        documents={documents}
        cache={cache}
        contextRuns={contextRuns}
      />
      {/* Use the legacy savings meter once below so token math is visible */}
      <GlassCard className="p-5">
        <TokenSavingsMeter compiled={compiled} saved={saved} />
        <p className="mt-4 text-sm leading-6 text-ice-muted">
          Cache is not memory. Memory stores durable facts. Cache reuses
          similar answers when dependencies are still fresh.
        </p>
      </GlassCard>
    </div>
  );
}

function CompanionCard({
  name,
  avatar,
  mood,
  onChat,
  onSettings,
}: {
  name: string;
  avatar: string | null;
  mood: ReturnType<typeof companionMood>;
  onChat: () => void;
  onSettings: () => void;
}) {
  return (
    <GlassCard className="companion-card overflow-hidden p-6">
      <div className="companion-card__content">
        <div className="companion-card__avatar">
          <div className="companion-orb grid h-36 w-36 place-items-center overflow-hidden rounded-full bg-[#07131f] md:h-40 md:w-40">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt={`${name} avatar`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src="/n0va.svg"
                alt={`${name} mascot`}
                width={120}
                height={120}
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <StatusPill
            className="companion-card__mood"
            tone={mood.tone}
            dot
          >
            {mood.label}
          </StatusPill>
        </div>
        <div className="companion-card__body">
          <p className="label-text">Your Companion</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ice">
            {name}
          </h2>
          <p className="mt-1 text-sm text-ice-muted">At your service.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-ice-muted">
            {mood.body}
          </p>
          <div className="companion-card__actions">
            <button className="button flex-1" onClick={onChat} type="button">
              <MessageCircle size={16} strokeWidth={1.8} />
              Ask N0Tune
            </button>
            <button
              className="button button-secondary"
              onClick={onSettings}
              type="button"
            >
              <SettingsIcon size={16} strokeWidth={1.8} />
              <span className="hidden sm:inline">Companion Settings</span>
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function ContextHealthCard({
  breakdown,
  preview,
}: {
  breakdown: ReturnType<typeof contextHealthBreakdown>;
  preview: ContextPreview | null;
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <p className="label-text">Context Health</p>
        <Activity size={16} strokeWidth={1.8} className="text-ice-muted" />
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-[140px_1fr] sm:items-center">
        <Ring score={breakdown.score} label={breakdown.label} />
        <ul className="space-y-2">
          {breakdown.metrics.map((metric) => (
            <li
              className="flex items-center justify-between text-sm"
              key={metric.label}
            >
              <span className="health-check">{metric.label}</span>
              <span className="font-semibold text-ice tabular-nums">
                {metric.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-ice-muted">
        Last compiled:{" "}
        <span className="text-ice">
          {preview ? "just now" : breakdown.lastCompiledLabel}
        </span>
        {" · "}
        <a className="text-memory hover:underline" href="#context-lab">
          View in Context Lab →
        </a>
      </p>
    </GlassCard>
  );
}

function Ring({ score, label }: { score: number; label: string }) {
  const radius = 56;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, score));
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className="context-ring" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4DE1D2" />
            <stop offset="100%" stopColor="#6C7CFF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="context-ring__value">
        <p className="text-3xl font-semibold tabular-nums text-ice">{safe}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-memory">
          {label}
        </p>
      </div>
    </div>
  );
}

function ModelRoutingCard({ onManage }: { onManage: () => void }) {
  // Honest: the API doesn't expose currently-configured provider yet.
  // Show what env vars would map to, mark as Planned introspection.
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="label-text">Current Model &amp; Routing</p>
        <button
          className="topbar-icon h-7 px-2 text-xs"
          onClick={onManage}
          type="button"
        >
          Change
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-glass-line bg-white/[0.04] p-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-memory/15 text-memory">
          <Cpu size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ice">Configured via env</p>
          <p className="text-xs text-ice-muted">
            via N0Tune Router{" "}
            <StatusPill tone="info" className="ml-1">
              PRIMARY
            </StatusPill>
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border border-glass-line bg-white/[0.04] p-3">
        <span className="text-sm text-ice">Smart routing</span>
        <StatusPill tone="success" dot>
          enabled
        </StatusPill>
      </div>
      <div className="mt-4">
        <p className="label-text">Fallback Order</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ice-muted">
          <span className="chip">Anthropic</span>
          <span aria-hidden="true">→</span>
          <span className="chip">OpenAI</span>
          <span aria-hidden="true">→</span>
          <span className="chip">Gemini</span>
          <span aria-hidden="true">→</span>
          <span className="chip">OpenRouter</span>
        </div>
        <p className="mt-3 text-xs text-ice-muted">
          Live model introspection (
          <span className="font-mono">GET /v1/providers/current</span>)
          is planned. Set <span className="font-mono">N0TUNE_PROVIDER_*</span>{" "}
          env vars before <span className="font-mono">docker compose up</span>.
        </p>
        <button
          className="mt-3 text-sm font-semibold text-memory hover:underline"
          onClick={onManage}
          type="button"
        >
          Manage Models &amp; Routing →
        </button>
      </div>
    </GlassCard>
  );
}

function MemoryLibraryCard({
  memories,
  stats,
  onView,
}: {
  memories: Memory[];
  stats: ReturnType<typeof memoryStats>;
  onView: () => void;
}) {
  const total = memories.length;
  const projects = stats.projects;
  const refs = total - stats.preferences - stats.projects - stats.style - stats.goals;
  const prefs = stats.preferences;
  const items: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Core Memories", value: total, Icon: Brain },
    { label: "Projects", value: projects, Icon: FolderKanban },
    { label: "References", value: Math.max(refs, 0), Icon: BookOpen },
    { label: "Preferences", value: prefs, Icon: Sliders },
  ];
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-text">Memory Library</p>
          <p className="mt-1 text-sm text-ice-muted">
            Your context, organized and ready.
          </p>
        </div>
        <button
          className="text-sm font-semibold text-memory hover:underline"
          onClick={onView}
          type="button"
        >
          View Library →
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ label, value, Icon }) => (
          <button
            className="category-tile"
            key={label}
            onClick={onView}
            type="button"
          >
            <span className="category-tile__icon">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <span className="text-2xl font-semibold tabular-nums text-ice">
              {value}
            </span>
            <span className="text-xs text-ice-muted">{label}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-ice-muted">
        Total: <span className="text-ice">{total} items</span> ·{" "}
        Updated{" "}
        <span className="text-ice">
          {memories[0] ? formatRelative(memories[0].updated_at) : "—"}
        </span>
      </p>
    </GlassCard>
  );
}

function TokenSavingsCard({
  savingsAgg,
  contextRuns,
  onView,
}: {
  savingsAgg: ReturnType<typeof aggregateRuns>;
  contextRuns: ContextRun[];
  onView: () => void;
}) {
  const naive = savingsAgg.totalTokens + savingsAgg.totalSaved;
  const pct = naive ? Math.round((savingsAgg.totalSaved / naive) * 100) : 0;
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <p className="label-text">Context Efficiency</p>
        <span className="chip" data-active="true">
          {contextRuns.length} runs
        </span>
      </div>
      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[120px_1fr]">
        <ArcMeter percent={pct} />
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span className="text-ice-muted">Tokens saved</span>
            <span className="font-semibold tabular-nums text-success">
              {savingsAgg.totalSaved.toLocaleString()}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-ice-muted">Tokens used</span>
            <span className="font-semibold tabular-nums text-ice">
              {savingsAgg.totalTokens.toLocaleString()}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-ice-muted">Est. cost saved</span>
            <span className="font-semibold tabular-nums text-ice-muted">
              — <span className="chip ml-1">planned</span>
            </span>
          </li>
        </ul>
      </div>
      <p className="mt-4 text-xs text-ice-muted">
        Compiled vs naive baseline across all context runs.{" "}
        <button
          className="font-semibold text-memory hover:underline"
          onClick={onView}
          type="button"
        >
          View Savings →
        </button>
      </p>
    </GlassCard>
  );
}

function ArcMeter({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  const radius = 50;
  const stroke = 8;
  const c = 2 * Math.PI * radius;
  // half ring (0..180°)
  const half = c / 2;
  const offset = half - (safe / 100) * half;
  return (
    <div className="context-ring" style={{ width: 120, height: 80 }}>
      <svg width="120" height="80" viewBox="0 0 120 80">
        <g transform="translate(60,60) rotate(-90)">
          <circle
            cx="0"
            cy="0"
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${half} ${c}`}
          />
          <circle
            cx="0"
            cy="0"
            r={radius}
            stroke="url(#arcGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${half - offset} ${c}`}
          />
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#4DE1D2" />
            </linearGradient>
          </defs>
        </g>
      </svg>
      <div className="context-ring__value" style={{ top: 22 }}>
        <p className="text-2xl font-semibold tabular-nums text-success">
          {safe}%
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ice-muted">
          saved
        </p>
      </div>
    </div>
  );
}

function SecurityStatusCard({
  documents,
  preview,
  health,
  onOpen,
}: {
  documents: DocumentItem[];
  preview: ContextPreview | null;
  health: Health | null;
  onOpen: () => void;
}) {
  const risky = riskyChunkCount(documents);
  const previewWarnings = preview?.warnings.length ?? 0;
  const rows: Array<{ label: string; value: string; tone: "success" | "warning" | "info" }> = [
    {
      label: "Local Runtime",
      value: health?.status === "ok" ? "Running" : "Checking",
      tone: health?.status === "ok" ? "success" : "warning",
    },
    { label: "Data Encryption", value: "Postgres + OS keychain", tone: "success" },
    { label: "Secrets Vault", value: "Locked", tone: "success" },
    {
      label: "Network Access",
      value: previewWarnings ? `${previewWarnings} warnings` : "Restricted",
      tone: previewWarnings ? "warning" : "success",
    },
    {
      label: "Plugin Permissions",
      value: risky ? `${risky} risky chunks` : "Least Privilege",
      tone: risky ? "warning" : "success",
    },
  ];
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <p className="label-text">Security Status</p>
        <StatusPill tone="success" dot>
          Secure
        </StatusPill>
      </div>
      <ul className="mt-4 divide-y divide-white/5 text-sm">
        {rows.map((row) => (
          <li
            className="flex items-center justify-between py-2"
            key={row.label}
          >
            <span className="health-check text-ice-muted">{row.label}</span>
            <StatusPill tone={row.tone}>{row.value}</StatusPill>
          </li>
        ))}
      </ul>
      <button
        className="mt-3 text-sm font-semibold text-memory hover:underline"
        onClick={onOpen}
        type="button"
      >
        Open Security Center →
      </button>
    </GlassCard>
  );
}

function RecentSessionsCard({
  runs,
  onViewAll,
  onEnter,
}: {
  runs: ContextRun[];
  onViewAll: () => void;
  onEnter: () => void;
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-text">Recent Sessions</p>
          <p className="mt-1 text-xs text-ice-muted">
            Live context runs. Real per-session summaries land with the
            session-summary endpoint.
          </p>
        </div>
        <button
          className="text-sm font-semibold text-memory hover:underline"
          onClick={onViewAll}
          type="button"
        >
          View All Sessions →
        </button>
      </div>
      <ul className="mt-4 space-y-3">
        {runs.length ? (
          runs.slice(0, 4).map((run) => {
            const tokens = run.prompt_tokens_estimated ?? 0;
            const pct = Math.max(2, Math.min(100, Math.round((tokens / 8000) * 100)));
            const band =
              pct >= 95
                ? "critical"
                : pct >= 80
                  ? "danger"
                  : pct >= 60
                    ? "watch"
                    : "safe";
            return (
              <li
                className="rounded-lg border border-glass-line bg-white/[0.04] p-3"
                key={run.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ice">
                      {run.request_id.slice(0, 24)}…
                    </p>
                    <p className="text-xs text-ice-muted">
                      user {run.user_id} · {formatRelative(run.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-ice">
                      {pct}%
                    </p>
                    <p className="text-[10px] text-ice-muted">
                      Context Pressure
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="pressure-bar flex-1" data-band={band}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    className="topbar-icon h-7 px-2 text-[11px]"
                    onClick={onEnter}
                    type="button"
                  >
                    Open
                  </button>
                </div>
              </li>
            );
          })
        ) : (
          <EmptyState
            title="No context runs yet"
            body="Run Context Lab or hit /v1/context/preview to create one."
          />
        )}
      </ul>
      <p className="mt-3 text-xs text-warning">
        Danger Zone detects high context pressure that may impact output
        quality.{" "}
        <a className="hover:underline" href="#sessions">
          Learn more →
        </a>
      </p>
    </GlassCard>
  );
}

function QuickActionsCard({
  onNavigate,
  loading,
}: {
  onNavigate: (key: NavKey) => void;
  loading: boolean;
}) {
  const actions: Array<{
    label: string;
    body: string;
    target: NavKey;
    Icon: LucideIcon;
  }> = [
    {
      label: "New Session",
      body: "Start a focused session",
      target: "context-lab",
      Icon: Plus,
    },
    {
      label: "Tune Context",
      body: "Build optimized context",
      target: "context-lab",
      Icon: Sparkles,
    },
    {
      label: "Import Memory",
      body: "Index a doc or note",
      target: "files",
      Icon: Download,
    },
    {
      label: "Run Evaluation",
      body: "Test & benchmark",
      target: "context-lab",
      Icon: ListChecks,
    },
    {
      label: "Create Handoff",
      body: "Share with runtime",
      target: "handoff",
      Icon: Network,
    },
    {
      label: "View Audit Logs",
      body: "Track system events",
      target: "audit",
      Icon: ScrollText,
    },
  ];
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <p className="label-text">Quick Actions</p>
        <StatusPill tone={loading ? "warning" : "success"} dot>
          {loading ? "refreshing" : "synced"}
        </StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ label, body, target, Icon }) => (
          <button
            className="quick-tile"
            key={label}
            onClick={() => onNavigate(target)}
            type="button"
          >
            <span className="quick-tile__icon">
              <Icon size={16} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ice">
                {label}
              </span>
              <span className="block text-xs text-ice-muted">{body}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        className="button button-secondary mt-4 w-full"
        onClick={() => onNavigate("settings")}
        type="button"
      >
        <SettingsIcon size={14} strokeWidth={1.8} /> Customize Dashboard
      </button>
    </GlassCard>
  );
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

function contextHealthBreakdown(
  health: Health | null,
  memories: Memory[],
  documents: DocumentItem[],
  contextRuns: ContextRun[],
  preview: ContextPreview | null,
) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const freshCount = memories.filter((memory) => {
    const updated = memory.updated_at ? new Date(memory.updated_at).getTime() : 0;
    return now - updated < sevenDays;
  }).length;
  const freshness = memories.length
    ? Math.round((freshCount / memories.length) * 100)
    : 0;

  const previewSimilarities = preview
    ? [
        ...preview.selected_memories.map((m) => m.similarity ?? 0),
        ...preview.selected_chunks.map((c) => c.similarity ?? 0),
      ]
    : [];
  const relevance = previewSimilarities.length
    ? Math.round(
        (previewSimilarities.reduce((sum, value) => sum + value, 0) /
          previewSimilarities.length) *
          100,
      )
    : 0;

  const density = (() => {
    const totals = contextRuns.reduce(
      (acc, run) => {
        acc.tokens += run.prompt_tokens_estimated ?? 0;
        acc.saved += run.prompt_tokens_saved_estimated ?? 0;
        return acc;
      },
      { tokens: 0, saved: 0 },
    );
    const naive = totals.tokens + totals.saved;
    return naive ? Math.round((totals.saved / naive) * 100) : 0;
  })();

  const confirmedCount = memories.filter((memory) =>
    Boolean(memory.last_confirmed_at),
  ).length;
  const coherence = memories.length
    ? Math.round((confirmedCount / memories.length) * 100)
    : 0;

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
  const coverage = Math.min(100, Math.round((totalChunks / 12) * 100));

  const score = Math.round(
    (freshness * 0.2 +
      relevance * 0.2 +
      density * 0.25 +
      coherence * 0.2 +
      coverage * 0.15) *
      (health?.status === "ok" ? 1 : 0.6),
  );

  let label = "Needs setup";
  if (score >= 85) label = "Excellent";
  else if (score >= 70) label = "Healthy";
  else if (score >= 50) label = "Stable";
  else if (score >= 30) label = "Watch";

  return {
    score,
    label,
    lastCompiledLabel: contextRuns[0]
      ? formatRelative(contextRuns[0].created_at)
      : "no runs yet",
    metrics: [
      { label: "Freshness", value: freshness },
      { label: "Relevance", value: relevance },
      { label: "Density", value: density },
      { label: "Coherence", value: coherence },
      { label: "Coverage", value: coverage },
    ],
  };
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
    <div className="space-y-5">
      <GlassCard className="p-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div>
            <StatusPill tone="info">Preview only - no model call</StatusPill>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ice">
              Same model. Same question. Different personal context.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-ice-muted">
              Context Lab proves context-tuning without faking assistant output.
              It seeds two users with different style memories, calls
              /v1/context/preview, and shows exactly what N0Tune would send to a
              model.
            </p>
          </div>
          <form className="space-y-3" onSubmit={onRun}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ice-muted">
                User A id
                <input
                  className="input mt-1"
                  value={userA}
                  onChange={(event) => setUserA(event.target.value)}
                />
              </label>
              <label className="text-xs font-semibold text-ice-muted">
                User B id
                <input
                  className="input mt-1"
                  value={userB}
                  onChange={(event) => setUserB(event.target.value)}
                />
              </label>
            </div>
            <label className="text-xs font-semibold text-ice-muted">
              Shared question
              <textarea
                className="input mt-1 min-h-24 resize-y"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="button"
                disabled={running}
                onClick={onSeed}
                type="button"
              >
                Seed demo
              </button>
              <button className="button button-secondary" disabled={running}>
                Run preview
              </button>
            </div>
            <p className="text-sm leading-6 text-ice-muted">{notice}</p>
          </form>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ContextPreviewPanel label="User A" userId={userA} preview={previewA} />
        <ContextPreviewPanel label="User B" userId={userB} preview={previewB} />
      </div>
    </div>
  );
}

type ShelfKey =
  | "all"
  | "preference"
  | "project"
  | "style"
  | "goal"
  | "summary"
  | "file"
  | "handoff"
  | "security"
  | "archived"
  | "expired"
  | "conflicted"
  | "low-confidence";

const SHELVES: Array<{ key: ShelfKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "preference", label: "Preferences" },
  { key: "project", label: "Project decisions" },
  { key: "style", label: "Coding style" },
  { key: "goal", label: "Current goals" },
  { key: "summary", label: "Session summaries" },
  { key: "file", label: "File knowledge" },
  { key: "handoff", label: "MCP handoffs" },
  { key: "security", label: "Security notes" },
  { key: "archived", label: "Archived" },
  { key: "expired", label: "Expired" },
  { key: "conflicted", label: "Conflicted" },
  { key: "low-confidence", label: "Low confidence" },
];

function MemoryLibrary({
  memories,
  style,
  searchResults,
  searchQuery,
  searchRunning,
  onSearch,
  onClearSearch,
  onCreate,
  onDelete,
  onConfirm,
  onEdit,
  onUpdateStyle,
}: {
  memories: Memory[];
  style: StyleProfile | null;
  searchResults: Memory[] | null;
  searchQuery: string;
  searchRunning: boolean;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (memoryId: string) => void;
  onConfirm: (memoryId: string) => void;
  onEdit: (memoryId: string, nextText: string) => Promise<void>;
  onUpdateStyle: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const stats = memoryStats(memories);
  const [shelf, setShelf] = useState<ShelfKey>("all");
  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const visible = useMemo(
    () => filterByShelf(searchResults ?? memories, shelf),
    [shelf, searchResults, memories],
  );
  const quality = useMemo(() => memoryQuality(memories), [memories]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Memory Library"
        body="Live memory CRUD plus shelf filters and semantic search via /v1/memories?q=. Duplicate clustering and full conflict review land later."
      />
      <MemoryShelves stats={stats} />

      <GlassCard className="p-5">
        <form
          className="grid gap-3 lg:grid-cols-[1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(draftQuery);
          }}
        >
          <label className="text-xs font-semibold text-ice-muted">
            Semantic search
            <input
              aria-label="Memory search"
              className="input mt-1"
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="What do I prefer for explanations?"
              value={draftQuery}
            />
          </label>
          <button className="button self-end" type="submit">
            Search
          </button>
          <button
            className="button button-secondary self-end"
            onClick={() => {
              setDraftQuery("");
              onClearSearch();
            }}
            type="button"
          >
            Clear
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {SHELVES.map((entry) => (
            <button
              className="chip"
              data-active={shelf === entry.key}
              key={entry.key}
              onClick={() => setShelf(entry.key)}
              type="button"
            >
              {entry.label} · {shelfCount(memories, entry.key)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ice-muted">
          {searchResults
            ? `${searchResults.length} semantic hit${
                searchResults.length === 1 ? "" : "s"
              } for "${searchQuery}". Shelf filter is applied on top.`
            : "Showing the local cached list. Use Search to call /v1/memories?q="}
          {searchRunning ? " · searching…" : ""}
        </p>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold text-ice">Add memory</h3>
          <form className="mt-4 space-y-3" onSubmit={onCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ice-muted">
                Type
                <input
                  className="input mt-1"
                  name="type"
                  defaultValue="preference"
                />
              </label>
              <label className="text-xs font-semibold text-ice-muted">
                Scope
                <input
                  className="input mt-1"
                  name="scope"
                  defaultValue="user"
                />
              </label>
            </div>
            <label className="text-xs font-semibold text-ice-muted">
              Memory text
              <textarea
                className="input mt-1 min-h-28 resize-y"
                name="text"
                placeholder="User prefers short technical answers."
              />
            </label>
            <label className="text-xs font-semibold text-ice-muted">
              Confidence
              <input
                className="input mt-1"
                name="confidence"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0.85"
              />
            </label>
            <button className="button">Save memory</button>
          </form>
        </GlassCard>

        <div className="space-y-4">
          <StyleEditor style={style} onSubmit={onUpdateStyle} />
          <MemoryQualityPanel quality={quality} />
          <GlassCard className="p-5">
            <SectionHeader
              title={
                shelf === "all"
                  ? "All memories"
                  : SHELVES.find((entry) => entry.key === shelf)?.label ??
                    "Shelf"
              }
              body={`${visible.length} row${visible.length === 1 ? "" : "s"} after shelf + search filter.`}
            />
            <div className="mt-4 grid gap-3">
              {visible.length ? (
                visible.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onConfirm={onConfirm}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                ))
              ) : (
                <EmptyState
                  title="No memories on this shelf"
                  body="Add one preference or run Context Lab to seed demo memories. Switch to the All shelf to see everything."
                />
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function MemoryQualityPanel({
  quality,
}: {
  quality: ReturnType<typeof memoryQuality>;
}) {
  return (
    <GlassCard className="p-5">
      <SectionHeader
        title="Memory quality"
        body="Heuristics computed from the loaded memory list. Full duplicate clustering uses the consolidate endpoint."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QualityCell
          label="Low confidence"
          value={quality.lowConfidence}
          hint="confidence < 0.5"
          tone={quality.lowConfidence ? "warning" : "success"}
        />
        <QualityCell
          label="Never confirmed"
          value={quality.neverConfirmed}
          hint="no last_confirmed_at"
          tone={quality.neverConfirmed ? "warning" : "success"}
        />
        <QualityCell
          label="Expiring soon"
          value={quality.expiringSoon}
          hint="< 7 days"
          tone={quality.expiringSoon ? "warning" : "success"}
        />
        <QualityCell
          label="Possible duplicates"
          value={quality.duplicates}
          hint="identical text"
          tone={quality.duplicates ? "warning" : "success"}
        />
      </div>
    </GlassCard>
  );
}

function QualityCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-glass-line bg-white/[0.04] p-3">
      <p className="label-text">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          tone === "warning" ? "text-warning" : "text-success"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-ice-muted">{hint}</p>
    </div>
  );
}

function filterByShelf(memories: Memory[], shelf: ShelfKey): Memory[] {
  const now = Date.now();
  switch (shelf) {
    case "all":
      return memories;
    case "preference":
    case "project":
    case "style":
    case "goal":
    case "summary":
    case "file":
    case "handoff":
    case "security":
      return memories.filter((memory) => memory.type === shelf);
    case "archived":
      return memories.filter((memory) => memory.state === "archived");
    case "expired":
      return memories.filter((memory) =>
        memory.expires_at
          ? new Date(memory.expires_at).getTime() < now
          : false,
      );
    case "conflicted":
      return memories.filter(
        (memory) =>
          memory.state === "conflicted" ||
          memory.state === "deprecated" ||
          Boolean(memory.replaced_by_memory_id),
      );
    case "low-confidence":
      return memories.filter((memory) => memory.confidence < 0.5);
    default:
      return memories;
  }
}

function shelfCount(memories: Memory[], shelf: ShelfKey): number {
  return filterByShelf(memories, shelf).length;
}

function memoryQuality(memories: Memory[]) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const lowConfidence = memories.filter((memory) => memory.confidence < 0.5)
    .length;
  const neverConfirmed = memories.filter(
    (memory) => !memory.last_confirmed_at && memory.state === "active",
  ).length;
  const expiringSoon = memories.filter((memory) => {
    if (!memory.expires_at) return false;
    const expiry = new Date(memory.expires_at).getTime();
    return expiry > now && expiry - now < sevenDays;
  }).length;
  const seen = new Map<string, number>();
  for (const memory of memories) {
    seen.set(memory.text, (seen.get(memory.text) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of seen.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return { lowConfidence, neverConfirmed, expiringSoon, duplicates };
}

function StyleEditor({
  style,
  onSubmit,
}: {
  style: StyleProfile | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const profile = style?.profile_json ?? {};
  const serverTone = String(profile.tone ?? "");
  const serverDepth = String(profile.depth ?? "");
  const serverFormat = String(profile.format ?? "");
  const serverAvoid = Array.isArray(profile.avoid) ? profile.avoid.join(", ") : "";

  // Controlled state so the form survives background refreshes without
  // wiping the user's in-progress edits. Sync to the server value whenever
  // the user hasn't touched the field yet (touched=false) or after the
  // server value changes from a successful PATCH.
  const [tone, setTone] = useState(serverTone);
  const [depth, setDepth] = useState(serverDepth);
  const [format, setFormat] = useState(serverFormat);
  const [avoid, setAvoid] = useState(serverAvoid);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) {
      setTone(serverTone);
      setDepth(serverDepth);
      setFormat(serverFormat);
      setAvoid(serverAvoid);
    }
  }, [serverTone, serverDepth, serverFormat, serverAvoid, touched]);

  return (
    <GlassCard className="p-5">
      <h3 className="text-lg font-semibold text-ice">Style profile</h3>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-4"
        onSubmit={(event) => {
          onSubmit(event);
          // After submit, the parent re-fetches the style and updates
          // serverTone/etc. We mark the form as untouched so the next
          // server update syncs in (e.g. crisp after a successful PATCH).
          setTouched(false);
        }}
      >
        <label className="text-xs font-semibold text-ice-muted">
          Tone
          <input
            className="input mt-1"
            name="tone"
            value={tone}
            onChange={(event) => {
              setTouched(true);
              setTone(event.target.value);
            }}
          />
        </label>
        <label className="text-xs font-semibold text-ice-muted">
          Depth
          <input
            className="input mt-1"
            name="depth"
            value={depth}
            onChange={(event) => {
              setTouched(true);
              setDepth(event.target.value);
            }}
          />
        </label>
        <label className="text-xs font-semibold text-ice-muted">
          Format
          <input
            className="input mt-1"
            name="format"
            value={format}
            onChange={(event) => {
              setTouched(true);
              setFormat(event.target.value);
            }}
          />
        </label>
        <label className="text-xs font-semibold text-ice-muted">
          Avoid
          <input
            className="input mt-1"
            name="avoid"
            value={avoid}
            onChange={(event) => {
              setTouched(true);
              setAvoid(event.target.value);
            }}
          />
        </label>
        <button className="button lg:col-span-4">Update style profile</button>
      </form>
    </GlassCard>
  );
}

function FilesPage({
  documents,
  onCreate,
}: {
  documents: DocumentItem[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Files / Knowledge"
        body="Files are indexed knowledge. Memories are learned user or project facts. This page uses the live documents API."
      />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold text-ice">Index document</h3>
          <form className="mt-4 space-y-3" onSubmit={onCreate}>
            <label className="text-xs font-semibold text-ice-muted">
              Title
              <input className="input mt-1" name="title" />
            </label>
            <label className="text-xs font-semibold text-ice-muted">
              Source
              <input
                className="input mt-1"
                name="source"
                defaultValue="dashboard"
              />
            </label>
            <label className="text-xs font-semibold text-ice-muted">
              Content
              <textarea
                className="input mt-1 min-h-40 resize-y"
                name="content"
              />
            </label>
            <button className="button">Index document</button>
          </form>
        </GlassCard>
        <GlassCard className="p-5">
          <SectionHeader
            title="Indexed documents"
            body="Prompt-injection risk is scored per chunk by the Gateway."
          />
          <div className="mt-4 space-y-3">
            {documents.length ? (
              documents.map((doc) => (
                <DocumentCard document={doc} key={doc.id} />
              ))
            ) : (
              <EmptyState
                title="No indexed documents"
                body="Index markdown or text first. Folder sync belongs to CLI/Desktop."
              />
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function CachePage({
  cache,
  runs,
  onClear,
}: {
  cache: CacheList | null;
  runs: ContextRun[];
  onClear: () => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Semantic Cache"
        body="Cache is not memory. It reuses similar answers when dependencies are still fresh."
        action={
          <button className="button button-danger" onClick={onClear}>
            Clear cache
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Cache entries" value={String(cache?.total ?? 0)} />
        <StatCard label="Hit rate" value={cacheHitRate(runs)} tone="success" />
        <StatCard
          label="Tracked runs"
          value={String(runs.length)}
          detail="Context run telemetry, not full sessions"
        />
      </div>
      <GlassCard className="p-5">
        <div className="space-y-3">
          {cache?.entries.length ? (
            cache.entries.map((entry) => (
              <div
                className="rounded-lg border border-glass-line bg-white/[0.04] p-4"
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ice">{entry.model}</p>
                    <p className="mt-1 font-mono text-xs text-ice-muted">
                      {entry.input_hash.slice(0, 24)}
                    </p>
                  </div>
                  <StatusPill tone={entry.expires_at ? "warning" : "success"}>
                    {entry.expires_at ? "ttl" : "fresh"}
                  </StatusPill>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-ice-muted">
                  {entry.answer}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              title="Cache is empty"
              body="Run /v1/chat twice with a similar request to see safe reuse."
            />
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function SecurityPage({
  documents,
  preview,
}: {
  documents: DocumentItem[];
  preview: ContextPreview | null;
}) {
  const risky = riskyChunkCount(documents);
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Security"
        body="N0Tune should build trust without scary walls of text. These controls are live in Gateway unless marked planned."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SecurityCard
          title="Secret detection"
          status="Safe"
          body="Memory storage rejects common API keys, passwords, private keys, tokens, and cookies."
        />
        <SecurityCard
          title="Prompt injection"
          status={risky ? "Needs attention" : "Safe"}
          body={`${risky} risky document chunks are currently indexed.`}
        />
        <SecurityCard
          title="MCP safety"
          status="Safe"
          body="The MCP server is stdio/local by default and exposes no shell execution."
        />
        <SecurityCard
          title="Provider keys"
          status="Planned"
          body="Dashboard provider-key storage is planned. Gateway reads provider credentials from environment variables today."
          planned
        />
        <SecurityCard
          title="Memory privacy"
          status="Safe"
          body="API queries are scoped by app_id and user_id where applicable."
        />
        <SecurityCard
          title="Context warnings"
          status={preview?.warnings.length ? "Needs attention" : "Safe"}
          body={
            preview?.warnings.join("; ") ||
            "No warnings from the latest preview in this browser session."
          }
        />
      </div>
    </div>
  );
}

function AuditPage({
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
    <div className="space-y-5">
      <SectionHeader
        title="Audit Logs"
        body="This is a developer/team surface. Owner or admin API key is required."
      />
      <GlassCard className="p-5">
        <form className="flex flex-wrap gap-3" onSubmit={onLoad}>
          <label className="min-w-[280px] flex-1 text-xs font-semibold text-ice-muted">
            Owner/admin API key
            <input
              className="input mt-1"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Held in browser state only"
            />
          </label>
          <button className="button self-end">Load audit logs</button>
        </form>
        <p className="mt-3 text-sm text-ice-muted">{notice}</p>
      </GlassCard>
      <GlassCard className="p-5">
        <div className="space-y-3">
          {logs.length ? (
            logs.map((log) => (
              <div
                className="rounded-lg border border-glass-line bg-white/[0.04] p-4"
                key={log.id}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <p className="font-semibold text-ice">{log.action}</p>
                  <p className="text-xs text-ice-muted">
                    {formatDate(log.created_at)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ice-muted">
                  {log.resource_type} {log.resource_id ?? ""} by{" "}
                  {log.actor_role ?? "unknown"}
                </p>
                <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-ice-muted">
                  {JSON.stringify(log.metadata_json, null, 2)}
                </pre>
              </div>
            ))
          ) : (
            <EmptyState
              title="No audit logs loaded"
              body="Enter an owner or admin key to inspect sensitive operations."
            />
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function McpPage({ appId, userId }: { appId: string; userId: string }) {
  const tools = [
    ["n0tune_search_memories", "Find memories by semantic + keyword match."],
    ["n0tune_save_memory", "Persist a long-term memory."],
    ["n0tune_get_style_profile", "Read the user's style profile."],
    ["n0tune_search_docs", "Search indexed document chunks."],
    [
      "n0tune_context_preview",
      "Compile a context preview without calling a model.",
    ],
    ["n0tune_forget_memory", "Soft-delete a memory by id."],
    ["n0tune_get_persona", "Read the public persona shell (no private data)."],
    [
      "n0tune_alignment_check",
      "Lint a proposed agent response against rules.",
    ],
    ["n0tune_project_detect", "Detect the project by cwd."],
    ["n0tune_get_project_context", "Fetch project memory and handoffs."],
    ["n0tune_create_handoff_capsule", "Create a cross-tool handoff."],
    ["n0tune_get_latest_handoff", "Read the newest project handoff."],
    ["n0tune_continue_from_handoff", "Generate a continuation prompt."],
    ["n0tune_save_project_memory", "Save scoped project memory."],
    ["n0tune_search_project_memory", "Search scoped project memory."],
  ];

  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        n0tune: {
          command: "node",
          args: [
            "C:/absolute/path/to/N0Tune/integrations/mcp-server/src/server.mjs",
          ],
          env: {
            N0TUNE_API_BASE_URL: apiBaseUrl,
            N0TUNE_API_KEY: "replace-with-local-development-key",
            N0TUNE_APP_ID: appId,
            N0TUNE_USER_ID: userId,
          },
        },
      },
    },
    null,
    2,
  );

  const claudeCode = `claude mcp add-json n0tune '${JSON.stringify({
    command: "node",
    args: ["./integrations/mcp-server/src/server.mjs"],
    env: {
      N0TUNE_API_BASE_URL: apiBaseUrl,
      N0TUNE_API_KEY: "replace-with-local-development-key",
      N0TUNE_APP_ID: appId,
      N0TUNE_USER_ID: userId,
    },
  })}' --scope project`;

  const cursor = JSON.stringify(
    {
      mcpServers: {
        n0tune: {
          command: "node",
          args: ["./integrations/mcp-server/src/server.mjs"],
          env: {
            N0TUNE_API_BASE_URL: apiBaseUrl,
            N0TUNE_API_KEY: "replace-with-local-development-key",
            N0TUNE_APP_ID: appId,
          },
        },
      },
    },
    null,
    2,
  );

  const codex = `# ~/.codex/config.toml
[[mcp_servers]]
name = "n0tune"
command = "node"
args = ["./integrations/mcp-server/src/server.mjs"]

[mcp_servers.env]
N0TUNE_API_BASE_URL = "${apiBaseUrl}"
N0TUNE_API_KEY = "replace-with-local-development-key"
N0TUNE_APP_ID = "${appId}"
N0TUNE_USER_ID = "${userId}"`;

  const [healthNotice, setHealthNotice] = useState(
    "Test only checks the Gateway endpoint. The MCP server itself is stdio and starts when your client launches it.",
  );
  const [testMemoryNotice, setTestMemoryNotice] = useState(
    "Send a tagged test memory to verify the dashboard ↔ Gateway round-trip works.",
  );

  const [mcpError, setMcpError] = useState("");

  async function sendTestMemory() {
    setTestMemoryNotice("POSTing /v1/memories…");
    setMcpError("");
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/v1/memories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: appId,
            user_id: userId,
            type: "preference",
            text: `MCP round-trip test sent at ${new Date().toISOString()}`,
            confidence: 0.9,
            scope: "user",
          }),
        },
      );
      if (!response.ok) {
        setMcpError(`POST /v1/memories failed: ${response.status}`);
        setTestMemoryNotice("Test memory was not saved.");
        return;
      }
      const memory = (await response.json()) as { id?: string };
      setTestMemoryNotice(
        `Test memory saved as ${memory.id ?? "?"} · query "MCP round-trip test" via n0tune_search_memories to verify.`,
      );
    } catch (error) {
      setMcpError(
        error instanceof Error ? error.message : "POST /v1/memories failed.",
      );
      setTestMemoryNotice("Test memory was not saved.");
    }
  }

  async function testGateway() {
    setHealthNotice("Calling /health…");
    setMcpError("");
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/health`);
      if (!response.ok) {
        setMcpError(`GET /health failed: ${response.status}`);
        setHealthNotice("Gateway health check failed.");
        return;
      }
      const data = (await response.json()) as { status?: string };
      setHealthNotice(
        data.status === "ok"
          ? "Gateway healthy. The MCP server will read from this base URL."
          : `Gateway status: ${data.status ?? "unknown"}`,
      );
    } catch (error) {
      setMcpError(
        error instanceof Error ? error.message : "Gateway unreachable.",
      );
      setHealthNotice("Gateway health check failed.");
    }
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <StatusPill tone="warning">Partial · stdio MCP shipped</StatusPill>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ice">
          MCP &amp; Plugins
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ice-muted">
          The local stdio MCP server is implemented. Copy the right config for
          your tool, restart it, and N0Tune will appear in the tools list.
          One-click dashboard install and live MCP handshake remain planned —
          stdio servers boot when the client starts them, not when the
          dashboard does.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="button" onClick={testGateway} type="button">
            Test Gateway endpoint
          </button>
          <button
            className="button button-secondary"
            onClick={sendTestMemory}
            type="button"
          >
            Send test memory
          </button>
          <a
            className="button button-secondary"
            href="https://github.com/MITPOAI/N0Tune/blob/main/docs/wire-to-claude.md"
            rel="noreferrer"
            target="_blank"
          >
            Open wire-to-claude.md
          </a>
        </div>
        <p className="mt-3 text-sm text-ice-muted">{healthNotice}</p>
        <p className="mt-1 text-sm text-ice-muted">{testMemoryNotice}</p>
        {mcpError ? (
          <div className="mt-3">
            <ErrorState title="MCP gateway check failed" body={mcpError} />
          </div>
        ) : null}
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigCard
          title="Claude Desktop"
          description="Edit claude_desktop_config.json. The Settings UI shows the exact path."
          payload={claudeDesktop}
        />
        <ConfigCard
          title="Claude Code"
          description="One-liner that writes the project-scope .mcp.json. Run from the repo root."
          payload={claudeCode}
          language="bash"
        />
        <ConfigCard
          title="Cursor"
          description="Cursor uses the same MCP config format. Add to ~/.cursor/mcp.json."
          payload={cursor}
        />
        <ConfigCard
          title="Codex CLI"
          description="Add to ~/.codex/config.toml. Codex reads stdio MCP servers from TOML."
          payload={codex}
          language="toml"
        />
      </div>

      <GlassCard className="p-5">
        <SectionHeader
          title="Live MCP tools today"
          body="These ship with integrations/mcp-server, including project detection and Handoff Capsules."
        />
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {tools.map(([tool, description]) => (
            <div
              className="rounded-lg border border-glass-line bg-black/25 p-3"
              key={tool}
            >
              <code className="text-sm text-memory">{tool}</code>
              <p className="mt-1 text-xs leading-5 text-ice-muted">
                {description}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function ConfigCard({
  title,
  description,
  payload,
  language,
}: {
  title: string;
  description: string;
  payload: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <GlassCard className="p-5">
      <SectionHeader title={title} body={description} />
      <div className="copy-block mt-4">
        <button
          className="copy-button"
          onClick={() => {
            copyToClipboard(payload);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre>
          {language ? `# ${language}\n` : ""}
          {payload}
        </pre>
      </div>
    </GlassCard>
  );
}

function SessionsPage({
  runs,
  sessions,
  onCreateHandoff,
}: {
  runs: ContextRun[];
  sessions: ProjectSession[];
  onCreateHandoff: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? null,
    [runs, selectedId],
  );
  const aggregate = useMemo(() => aggregateRuns(runs), [runs]);
  const dangerZone = tokenDangerZone(aggregate.maxTokens);

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <StatusPill tone="success">Live - project sessions</StatusPill>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ice">
              Sessions
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ice-muted">
              Sessions are scoped to the detected project folder. Context runs
              still show compiler telemetry, while project sessions track tool
              name, goal, pressure, files, commands, summaries, and Handoff
              Capsule linkage.
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={onCreateHandoff}
            type="button"
          >
            Open Handoff Capsules
          </button>
        </div>
      </GlassCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Project sessions"
          value={String(sessions.length)}
          detail="Tracked by tool and project"
          tone={sessions.length ? "success" : "neutral"}
        />
        <StatCard
          label="Context runs"
          value={String(runs.length)}
          detail="Each preview or chat creates one"
          tone="info"
        />
        <StatCard
          label="Tokens compiled"
          value={aggregate.totalTokens.toLocaleString()}
          detail={`avg ${aggregate.avgTokens} per run`}
        />
        <StatCard
          label="Tokens saved"
          value={aggregate.totalSaved.toLocaleString()}
          detail={`${aggregate.savedRate}% of compiled`}
          tone="success"
        />
        <StatCard
          label="Cache hit rate"
          value={`${aggregate.hitRate}%`}
          detail={`${aggregate.hitCount} hits / ${runs.length} runs`}
          tone={aggregate.hitRate > 30 ? "success" : "info"}
        />
      </section>

      <GlassCard className="p-5">
        <SectionHeader
          title="Project sessions by tool"
          body="Real rows from /v1/projects/{project_id}/sessions."
        />
        {sessions.length ? (
          <div className="mt-4 space-y-3">
            {sessions.slice(0, 8).map((session) => (
              <article
                className="rounded-lg border border-glass-line bg-white/[0.04] p-4"
                key={session.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ice">{session.title}</p>
                    <p className="mt-1 text-sm text-ice-muted">
                      {session.tool_name} - {session.status} -{" "}
                      {session.context_pressure}
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      session.context_pressure === "critical" ||
                      session.context_pressure === "danger"
                        ? "danger"
                        : session.context_pressure === "watch"
                          ? "warning"
                          : "success"
                    }
                  >
                    {session.context_tokens_estimated.toLocaleString()} tokens
                  </StatusPill>
                </div>
                {session.goal ? (
                  <p className="mt-3 text-sm leading-6 text-ice-muted">
                    {session.goal}
                  </p>
                ) : null}
                {session.next_steps_json.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ice-muted">
                    {session.next_steps_json.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No project sessions yet"
            body={
              'Start one with `n0tune session start --tool claude --goal "..."` or through MCP.'
            }
          />
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <SectionHeader
          title="Context pressure meter"
          body="Tracks the largest prompt-token estimate across recent context runs and project sessions."
        />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="min-w-[180px]">
            <p className="text-4xl font-semibold text-ice tabular-nums">
              {aggregate.maxTokens.toLocaleString()}
            </p>
            <p className="text-xs text-ice-muted">peak compiled tokens</p>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="danger-meter">
              <span style={{ width: `${dangerZone.pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-ice-muted">
              <span>Safe</span>
              <span>Watch</span>
              <span>Danger</span>
              <span>Critical</span>
            </div>
          </div>
          <StatusPill tone={dangerZone.tone} dot>
            {dangerZone.label}
          </StatusPill>
        </div>
        <p className="mt-4 text-sm leading-6 text-ice-muted">
          {dangerZone.body}
        </p>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <GlassCard className="p-5">
          <SectionHeader
            title="Recent runs"
            body="Click a run to see selected memories, chunks, and trace reasons."
          />
          <div className="mt-4 space-y-2">
            {runs.length ? (
              runs.slice(0, 20).map((run) => (
                <button
                  className={`w-full rounded-lg border bg-white/[0.04] p-3 text-left transition hover:border-memory/35 hover:bg-memory/10 ${
                    selectedId === run.id
                      ? "border-memory/35 bg-memory/10"
                      : "border-glass-line"
                  }`}
                  key={run.id}
                  onClick={() => setSelectedId(run.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs text-ice-muted">
                      {run.request_id}
                    </p>
                    <StatusPill tone={run.cache_hit ? "success" : "info"}>
                      {run.cache_hit ? "cache hit" : "cache miss"}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-ice">user {run.user_id}</p>
                  <p className="mt-1 text-xs text-ice-muted">
                    {run.prompt_tokens_estimated} tokens · saved{" "}
                    {run.prompt_tokens_saved_estimated} · {formatDate(run.created_at)}
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No context runs yet"
                body="Run Context Lab or a Command Center context preview to create one."
              />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title={selected ? "Run detail" : "Select a run"}
            body={
              selected
                ? `Selected memories, chunks, and trace for ${selected.request_id}.`
                : "Pick any run to see its compiled detail."
            }
          />
          {selected ? <RunDetail run={selected} /> : (
            <EmptyState
              title="Nothing selected"
              body="Click a run on the left to inspect its compiled context picks."
            />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function RunDetail({ run }: { run: ContextRun }) {
  const memories = run.selected_memories_json ?? [];
  const chunks = run.selected_chunks_json ?? [];
  const style = run.selected_style_json ?? {};
  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <StatusPill tone="info">{memories.length} memories</StatusPill>
        <StatusPill tone="info">{chunks.length} doc chunks</StatusPill>
      </div>
      <DetailList
        title="Selected memories"
        empty="No memory was selected"
        items={memories.map(
          (memory) =>
            `[${memory.type ?? "memory"}] ${memory.text ?? memory.id}`,
        )}
      />
      <DetailList
        title="Selected chunks"
        empty="No chunk was selected"
        items={chunks.map((chunk) => chunk.id)}
      />
      <details className="rounded-lg border border-glass-line bg-black/25 p-3 text-xs text-ice-muted">
        <summary className="cursor-pointer text-ice">Style snapshot</summary>
        <pre className="mt-3 overflow-auto">
          {JSON.stringify(style, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function aggregateRuns(runs: ContextRun[]) {
  const totalTokens = runs.reduce(
    (sum, run) => sum + (run.prompt_tokens_estimated ?? 0),
    0,
  );
  const totalSaved = runs.reduce(
    (sum, run) => sum + (run.prompt_tokens_saved_estimated ?? 0),
    0,
  );
  const maxTokens = runs.reduce(
    (max, run) => Math.max(max, run.prompt_tokens_estimated ?? 0),
    0,
  );
  const hitCount = runs.filter((run) => run.cache_hit).length;
  const avgTokens = runs.length ? Math.round(totalTokens / runs.length) : 0;
  const savedRate = totalTokens
    ? Math.round((totalSaved / (totalTokens + totalSaved)) * 100)
    : 0;
  const hitRate = runs.length ? Math.round((hitCount / runs.length) * 100) : 0;
  return {
    totalTokens,
    totalSaved,
    maxTokens,
    avgTokens,
    savedRate,
    hitRate,
    hitCount,
  };
}

function tokenDangerZone(maxTokens: number) {
  // Reference budget: a generous personal-runtime envelope. This is honest
  // approximation, not a fake claim of provider limits.
  const budget = 8000;
  const pct = Math.max(2, Math.min(100, Math.round((maxTokens / budget) * 100)));
  if (pct >= 95) {
    return {
      pct,
      label: "Critical",
      tone: "danger" as const,
      body: "Compiled context is approaching the 8k reference budget. Summarize the session and create a Handoff Capsule before sending more.",
    };
  }
  if (pct >= 80) {
    return {
      pct,
      label: "Danger",
      tone: "danger" as const,
      body: "Compiled context is large. Plan to summarize or open Context Lab to verify what is being included.",
    };
  }
  if (pct >= 60) {
    return {
      pct,
      label: "Watch",
      tone: "warning" as const,
      body: "Context is healthy but trending up. A short summarize-now action will keep N0Tune economical.",
    };
  }
  return {
    pct,
    label: "Safe",
    tone: "success" as const,
    body: "Plenty of room in the compiled context. Nothing to do.",
  };
}

function HandoffPage({
  currentProject,
  handoffs,
  continuationPrompt,
  onContinue,
}: {
  currentProject: ProjectDetectResult | null;
  handoffs: HandoffCapsule[];
  continuationPrompt: string;
  onContinue: (handoffId: string, targetTool?: string) => void;
}) {
  const latest = handoffs[0] ?? null;
  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <StatusPill tone="success">Live Handoff Capsules</StatusPill>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ice">
          Handoff Capsules
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ice-muted">
          Stop rewriting handoff docs. N0Tune stores project state, decisions,
          changed files, commands, test results, next steps, and warnings so
          Claude, Codex, Cursor, or another MCP client can continue in the same
          folder.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard
            label="Detected project"
            value={currentProject?.project_name ?? "Not detected"}
            detail={currentProject?.project_id ?? "Project detection pending"}
            tone={currentProject ? "success" : "warning"}
          />
          <StatCard
            label="Capsules"
            value={String(handoffs.length)}
            detail="Latest first"
            tone={handoffs.length ? "success" : "neutral"}
          />
          <StatCard
            label="MCP ready"
            value="8 tools"
            detail="Project detect, context, memory, handoffs"
            tone="info"
          />
        </div>
      </GlassCard>

      {latest ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <GlassCard className="p-5">
            <SectionHeader
              title={latest.title}
              body={`${latest.source_tool} to ${latest.target_tool ?? "any tool"} - ${formatDate(latest.created_at)}`}
              action={
                <button
                  className="button"
                  onClick={() => onContinue(latest.id, "codex")}
                  type="button"
                >
                  Continue in Codex
                </button>
              }
            />
            {latest.goal ? (
              <p className="mt-4 text-sm leading-6 text-ice-muted">
                {latest.goal}
              </p>
            ) : null}
            <p className="mt-4 rounded-lg border border-glass-line bg-black/20 p-3 text-sm leading-6 text-ice-muted">
              {latest.current_state}
            </p>
            <HandoffList title="Next steps" items={latest.next_steps_json} />
            <HandoffList title="Decisions" items={latest.decisions_json} />
            <HandoffList title="Tests run" items={latest.tests_run_json} />
            <HandoffList title="Warnings" items={latest.warnings_json} />
          </GlassCard>

          <GlassCard className="p-5">
            <SectionHeader
              title="Continuation prompt"
              body="Generated by POST /v1/handoffs/{id}/continue-prompt."
            />
            <div className="copy-block mt-4">
              <button
                className="copy-button"
                onClick={() => copyToClipboard(continuationPrompt)}
                type="button"
              >
                Copy
              </button>
              <pre>
                {continuationPrompt ||
                  "Click Continue in Codex to generate the prompt."}
              </pre>
            </div>
          </GlassCard>
        </div>
      ) : (
        <EmptyState
          title="No Handoff Capsule yet"
          body={
            'Create one with `n0tune handoff create --source claude "current state"`, or call n0tune_create_handoff_capsule from MCP.'
          }
        />
      )}

      <GlassCard className="p-5">
        <SectionHeader
          title="Recent capsules"
          body="Project-scoped capsules from /v1/projects/{project_id}/handoffs."
        />
        <div className="mt-4 grid gap-3">
          {handoffs.map((handoff) => (
            <button
              className="rounded-lg border border-glass-line bg-white/[0.04] p-4 text-left transition hover:border-memory/40"
              key={handoff.id}
              onClick={() => onContinue(handoff.id, handoff.target_tool ?? "codex")}
              type="button"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ice">{handoff.title}</p>
                  <p className="mt-1 text-sm text-ice-muted">
                    {handoff.source_tool} to {handoff.target_tool ?? "any tool"}
                  </p>
                </div>
                <StatusPill tone="info">{handoff.id}</StatusPill>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function HandoffList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="label-text">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ice-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(value);
  }
}

function ModelsPage() {
  const providers: Array<{
    name: string;
    kind: string;
    role: string;
    privacy: string;
    envVars: string[];
  }> = [
    {
      name: "OpenAI",
      kind: "openai",
      role: "Primary chat + embeddings",
      privacy: "Cloud. Requests leave the machine.",
      envVars: ["N0TUNE_PROVIDER_KIND=openai", "N0TUNE_PROVIDER_API_KEY=…"],
    },
    {
      name: "Anthropic Claude",
      kind: "anthropic",
      role: "Long-context reasoning",
      privacy: "Cloud. Requests leave the machine.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=anthropic",
        "N0TUNE_PROVIDER_BASE_URL=https://api.anthropic.com",
        "N0TUNE_PROVIDER_API_KEY=…",
      ],
    },
    {
      name: "Google Gemini",
      kind: "gemini",
      role: "Multimodal fallback",
      privacy: "Cloud. Requests leave the machine.",
      envVars: ["N0TUNE_PROVIDER_KIND=gemini", "N0TUNE_PROVIDER_API_KEY=…"],
    },
    {
      name: "OpenRouter",
      kind: "openai",
      role: "Provider-of-providers",
      privacy: "Cloud. Routed through OpenRouter.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=openai",
        "N0TUNE_PROVIDER_BASE_URL=https://openrouter.ai/api/v1",
        "N0TUNE_PROVIDER_API_KEY=…",
      ],
    },
    {
      name: "Qwen",
      kind: "openai",
      role: "Open weights via DashScope or OpenAI-compatible host",
      privacy: "Cloud or self-hosted depending on base URL.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=openai",
        "N0TUNE_PROVIDER_BASE_URL=https://…",
        "N0TUNE_PROVIDER_API_KEY=…",
      ],
    },
    {
      name: "Ollama",
      kind: "openai",
      role: "Local models on your machine",
      privacy: "Local. Stays on the device.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=openai",
        "N0TUNE_PROVIDER_BASE_URL=http://localhost:11434/v1",
      ],
    },
    {
      name: "LM Studio",
      kind: "openai",
      role: "Local OpenAI-compatible server",
      privacy: "Local. Stays on the device.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=openai",
        "N0TUNE_PROVIDER_BASE_URL=http://localhost:1234/v1",
      ],
    },
    {
      name: "Custom OpenAI-compatible",
      kind: "openai",
      role: "Any vendor speaking the OpenAI wire format",
      privacy: "Depends on your endpoint.",
      envVars: [
        "N0TUNE_PROVIDER_KIND=openai",
        "N0TUNE_PROVIDER_BASE_URL=https://…",
        "N0TUNE_PROVIDER_API_KEY=…",
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success" dot>
              Live · env config
            </StatusPill>
            <StatusPill tone="planned">
              In-dashboard key form planned
            </StatusPill>
          </div>
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ice">
          Models &amp; Providers
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ice-muted">
          N0Tune is open source and the Gateway is your box. Choose any model
          and set the three <span className="font-mono">N0TUNE_PROVIDER_*</span>{" "}
          env vars below before <span className="font-mono">docker compose up</span>{" "}
          (or before <span className="font-mono">uvicorn</span> if you run the
          API directly). The provider router supports openai-compatible,
          anthropic (<span className="font-mono">/v1/messages</span>), and
          gemini (<span className="font-mono">generateContent</span>) — already
          working today.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ice-muted">
          The dashboard does not paste keys into the browser by design — keys
          stay in your <span className="font-mono">.env</span> or process
          environment. A future per-user key form will store keys in the
          Gateway, not the browser.
        </p>
      </GlassCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
        {providers.map((provider) => (
          <GlassCard className="p-5" key={provider.name}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-ice">
                  {provider.name}
                </p>
                <p className="mt-1 text-xs text-ice-muted">
                  Wire shape:{" "}
                  <span className="font-mono">{provider.kind}</span>
                </p>
              </div>
              <StatusPill tone="success" dot>
                Live via env
              </StatusPill>
            </div>
            <p className="mt-3 text-sm leading-6 text-ice-muted">
              {provider.role}
            </p>
            <div className="copy-block mt-3">
              <button
                className="copy-button"
                onClick={() => copyToClipboard(provider.envVars.join("\n"))}
                type="button"
              >
                Copy
              </button>
              <pre>{provider.envVars.join("\n")}</pre>
            </div>
            <p className="mt-3 text-xs text-ice-muted">{provider.privacy}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({
  appId,
  userId,
  companionName,
  companionAvatar,
  companionNotice,
  onCompanionName,
  onCompanionAvatar,
  onCompanionAvatarFile,
}: {
  appId: string;
  userId: string;
  companionName: string;
  companionAvatar: string | null;
  companionNotice: string;
  onCompanionName: (value: string) => void;
  onCompanionAvatar: (value: string | null) => void;
  onCompanionAvatarFile: (file: File | null) => void;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showDemoLabels, setShowDemoLabels] = useState(true);
  const [exportNotice, setExportNotice] = useState(
    "Export downloads every memory for this user as JSON, including soft-deleted and deprecated rows.",
  );
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const stored = window.localStorage.getItem("n0tune.theme") as
      | "dark"
      | "light"
      | null;
    const storedMotion = window.localStorage.getItem("n0tune.motion");
    const storedDemo = window.localStorage.getItem("n0tune.demoLabels");
    if (stored) setTheme(stored);
    if (storedMotion === "reduced") setReducedMotion(true);
    if (storedDemo === "off") setShowDemoLabels(false);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("n0tune.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute(
      "data-motion",
      reducedMotion ? "reduced" : "default",
    );
    window.localStorage.setItem(
      "n0tune.motion",
      reducedMotion ? "reduced" : "default",
    );
  }, [reducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "n0tune.demoLabels",
      showDemoLabels ? "on" : "off",
    );
  }, [showDemoLabels]);

  async function exportMemories() {
    setExportNotice("Calling /v1/memories/export…");
    setExportError("");
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/v1/memories/export?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`,
      );
      if (!response.ok) {
        setExportError(`GET /v1/memories/export failed: ${response.status}`);
        setExportNotice("Export failed.");
        return;
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `n0tune-memories-${userId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportNotice(
        `Exported ${Array.isArray(data) ? data.length : 0} memory rows.`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Export failed.",
      );
      setExportNotice("Export failed.");
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        body="Workspace identity, appearance, privacy, and developer notes."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="p-5 xl:col-span-2">
          <SectionHeader
            title="Companion"
            body="Give your N0Tune companion a name and an avatar. Stored in this browser only."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="grid place-items-center">
              <div className="companion-orb grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-[#07131f]">
                {companionAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={companionAvatar}
                    alt={`${companionName} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-memory">
                    {companionName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-ice-muted">
                Companion name
                <input
                  aria-label="Companion name"
                  className="input mt-1"
                  maxLength={32}
                  onChange={(event) => onCompanionName(event.target.value)}
                  placeholder="N0va"
                  value={companionName}
                />
              </label>
              <div>
                <p className="label-text">Avatar (PNG / JPG / SVG / WebP, ≤ 1 MB)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="button button-secondary cursor-pointer">
                    Import image
                    <input
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) =>
                        onCompanionAvatarFile(event.target.files?.[0] ?? null)
                      }
                      type="file"
                    />
                  </label>
                  <button
                    className="button button-secondary"
                    disabled={!companionAvatar}
                    onClick={() => onCompanionAvatar(null)}
                    type="button"
                  >
                    Reset to logo
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => onCompanionName("N0va")}
                    type="button"
                  >
                    Reset name
                  </button>
                </div>
                {companionNotice ? (
                  <p className="mt-2 text-xs text-ice-muted">
                    {companionNotice}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ice-muted">
                    The avatar is read as a data URL and stored under{" "}
                    <span className="font-mono">n0tune.companion.avatar</span>{" "}
                    in localStorage. Nothing is uploaded to the Gateway.
                  </p>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader title="Workspace" />
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-mono text-ice">app_id: {appId}</p>
            <p className="font-mono text-ice">user_id: {userId}</p>
            <p className="text-ice-muted">
              These are also the topbar controls. They scope every API call and
              are stored in this browser only.
            </p>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Appearance"
            body="Theme and motion. Reduced motion shrinks transitions across the dashboard."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-glass-line p-3">
              <p className="label-text">Theme</p>
              <div className="mt-3 flex gap-2">
                <button
                  className="chip"
                  data-active={theme === "dark"}
                  onClick={() => setTheme("dark")}
                  type="button"
                >
                  Dark
                </button>
                <button
                  className="chip"
                  data-active={theme === "light"}
                  onClick={() => setTheme("light")}
                  type="button"
                >
                  Light
                </button>
              </div>
              <p className="mt-3 text-xs text-ice-muted">
                Light mode is partially tuned. Dark mode is the hero.
              </p>
            </div>
            <div className="rounded-lg border border-glass-line p-3">
              <p className="label-text">Motion</p>
              <label className="mt-3 flex items-center gap-2 text-sm text-ice">
                <input
                  checked={reducedMotion}
                  onChange={(event) => setReducedMotion(event.target.checked)}
                  type="checkbox"
                />
                Reduce motion
              </label>
              <p className="mt-3 text-xs text-ice-muted">
                Overrides the OS preference. Persisted in this browser.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Privacy &amp; demo data"
            body="N0Tune never sends telemetry. Demo labels make it obvious when something is example data."
          />
          <label className="mt-4 flex items-center gap-2 text-sm text-ice">
            <input
              checked={showDemoLabels}
              onChange={(event) => setShowDemoLabels(event.target.checked)}
              type="checkbox"
            />
            Show &quot;Demo data&quot; labels where present
          </label>
          <p className="mt-3 text-xs leading-5 text-ice-muted">
            The Context Lab seed action is the main place this matters today.
            Memory and document data shown elsewhere comes from the real
            Gateway.
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Export memories"
            body="Pulls every memory for this user, including soft-deleted and deprecated rows."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="button" onClick={exportMemories} type="button">
              Export JSON
            </button>
            <a
              className="button button-secondary"
              href={`${apiBaseUrl.replace(/\/$/, "")}/v1/memories/export?app_id=${encodeURIComponent(appId)}&user_id=${encodeURIComponent(userId)}`}
              rel="noreferrer"
              target="_blank"
            >
              Open raw JSON
            </a>
          </div>
          <p className="mt-3 text-sm leading-6 text-ice-muted">
            {exportNotice}
          </p>
          {exportError ? (
            <div className="mt-3">
              <ErrorState title="Memory export failed" body={exportError} />
            </div>
          ) : null}
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Deployment"
            body="N0Tune is open source. You own the Gateway and the keys."
          />
          <DeploymentDetail />
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Developer"
            body="Where N0Tune is reading from."
          />
          <p className="mt-3 font-mono text-sm text-ice">
            gateway: {apiBaseUrl}
          </p>
          <p className="mt-2 text-xs text-ice-muted">
            Set <span className="font-mono">NEXT_PUBLIC_N0TUNE_API_BASE_URL</span>{" "}
            before <span className="font-mono">npm run dev</span> to change it.
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader title="About" />
          <p className="mt-3 text-sm leading-6 text-ice-muted">
            N0Tune is an open-source shared context layer for AI tools. Same
            project, same memory, any AI tool.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill>v0.1.6</StatusPill>
            <StatusPill tone="success" dot>
              MIT licensed
            </StatusPill>
            <StatusPill tone="info">No telemetry</StatusPill>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ContextPreviewPanel({
  label,
  userId,
  preview,
}: {
  label: string;
  userId: string;
  preview: ContextPreview | null;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-ice">{label}</h3>
          <p className="break-words font-mono text-xs text-ice-muted">
            {userId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="info">
            tokens {preview?.prompt_tokens_estimated ?? 0}
          </StatusPill>
          <StatusPill tone="success">
            saved {preview?.tokens_saved_estimated ?? 0}
          </StatusPill>
          <StatusPill tone={preview?.warnings.length ? "warning" : "success"}>
            warnings {preview?.warnings.length ?? 0}
          </StatusPill>
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
      <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/35 p-4 text-xs leading-5 text-ice-muted">
        {preview?.compiled_context ?? "No preview yet."}
      </pre>
    </GlassCard>
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
    <section className="min-w-0">
      <h4 className="text-sm font-semibold text-ice">{title}</h4>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p
              className={`rounded-lg border p-2 text-xs leading-5 ${
                tone === "warning"
                  ? "border-warning/35 bg-warning/10 text-warning"
                  : "border-glass-line bg-white/[0.04] text-ice-muted"
              }`}
              key={item}
            >
              {item}
            </p>
          ))
        ) : empty ? (
          <p className="rounded-lg border border-glass-line bg-white/[0.04] p-2 text-xs text-ice-muted">
            {empty}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MemoryShelves({ stats }: { stats: ReturnType<typeof memoryStats> }) {
  const shelves = [
    ["Personal Preferences", stats.preferences],
    ["Project Decisions", stats.projects],
    ["Coding Style", stats.style],
    ["Current Goals", stats.goals],
    ["Archived", stats.archived],
    ["Expired", stats.expired],
  ] as const;
  return (
    <GlassCard className="p-5">
      <SectionHeader
        title="Memory shelves"
        body="Live memory rows grouped by type. Open Memory Library to filter, search, and audit quality."
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {shelves.map(([label, value]) => (
          <div
            className="rounded-lg border border-glass-line bg-white/[0.04] p-3"
            key={label}
          >
            <p className="text-sm font-semibold text-ice">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-memory tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function MemoryCard({
  memory,
  onConfirm,
  onDelete,
  onEdit,
}: {
  memory: Memory;
  onConfirm: (memoryId: string) => void;
  onDelete: (memoryId: string) => void;
  onEdit?: (memoryId: string, nextText: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.text);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const title = deriveMemoryTitle(memory);

  async function commitEdit() {
    if (!onEdit) return;
    setSaving(true);
    setEditError("");
    try {
      await onEdit(memory.id, draft);
      setEditing(false);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Edit failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-glass-line bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ice">{title}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone="info">{memory.type}</StatusPill>
            <StatusPill
              tone={memory.state === "active" ? "success" : "warning"}
            >
              {memory.state}
            </StatusPill>
            <StatusPill>{memory.scope}</StatusPill>
            {memory.replaced_by_memory_id ? (
              <StatusPill tone="planned">replaced by summary</StatusPill>
            ) : null}
          </div>
          {editing ? (
            <textarea
              aria-label="Memory text"
              className="input mt-3 min-h-28 resize-y"
              onChange={(event) => setDraft(event.target.value)}
              value={draft}
            />
          ) : (
            <p className="mt-3 break-words text-sm leading-6 text-ice">
              {memory.text}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                className="button"
                disabled={saving || draft.trim() === ""}
                onClick={commitEdit}
                type="button"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  setDraft(memory.text);
                  setEditing(false);
                  setEditError("");
                }}
                type="button"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="button button-secondary"
                disabled={!onEdit}
                onClick={() => setEditing(true)}
                type="button"
              >
                Edit
              </button>
              <button
                className="button button-secondary"
                onClick={() => onConfirm(memory.id)}
                type="button"
              >
                Confirm
              </button>
              <button
                className="button button-danger"
                onClick={() => onDelete(memory.id)}
                type="button"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {editError ? (
        <p className="mt-3 text-xs text-danger">{editError}</p>
      ) : null}
      <div className="mt-3 grid gap-2 text-xs text-ice-muted sm:grid-cols-4">
        <p>confidence {Math.round(memory.confidence * 100)}%</p>
        <p>version {memory.version}</p>
        <p>used {formatDate(memory.last_used_at)}</p>
        <p>confirmed {formatDate(memory.last_confirmed_at)}</p>
      </div>
      <p className="mt-2 text-xs text-ice-muted">
        source:{" "}
        <span className="font-mono">
          {memory.source_message_id ?? "—"}
        </span>
      </p>
    </article>
  );
}

function deriveMemoryTitle(memory: Memory): string {
  // Memory rows have no title field. Render a stable, non-duplicating label
  // so the card shows "type · date" rather than restating the body text.
  const type = memory.type.charAt(0).toUpperCase() + memory.type.slice(1);
  const date = memory.updated_at
    ? new Date(memory.updated_at).toLocaleDateString()
    : "";
  return date ? `${type} · ${date}` : type;
}

function DocumentCard({ document }: { document: DocumentItem }) {
  return (
    <article className="rounded-lg border border-glass-line bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ice">{document.title}</p>
          <p className="mt-1 break-words font-mono text-xs text-ice-muted">
            {document.source}
          </p>
        </div>
        <StatusPill
          tone={
            document.chunks.some((chunk) => chunk.injection_risk_score > 0.5)
              ? "warning"
              : "success"
          }
        >
          {document.chunks.length} chunks
        </StatusPill>
      </div>
      <p className="mt-3 font-mono text-xs text-ice-muted">
        hash {document.content_hash.slice(0, 16)}
      </p>
      <div className="mt-3 space-y-2">
        {document.chunks.slice(0, 3).map((chunk) => (
          <p
            className="rounded-lg border border-glass-line bg-black/20 p-2 text-xs leading-5 text-ice-muted"
            key={chunk.id}
          >
            chunk {chunk.chunk_index} - risk{" "}
            {chunk.injection_risk_score.toFixed(2)} - {chunk.text}
          </p>
        ))}
      </div>
    </article>
  );
}

function SecurityCard({
  title,
  status,
  body,
  planned = false,
}: {
  title: string;
  status: string;
  body: string;
  planned?: boolean;
}) {
  const tone = planned
    ? "planned"
    : status === "Safe"
      ? "success"
      : status === "Needs attention"
        ? "warning"
        : "danger";
  return (
    <GlassCard className="p-5">
      <StatusPill tone={tone}>{status}</StatusPill>
      <h3 className="mt-4 text-lg font-semibold text-ice">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ice-muted">{body}</p>
    </GlassCard>
  );
}

function StatusDot({ status }: { status: NavItem["status"] }) {
  const color =
    status === "live"
      ? "bg-success"
      : status === "partial"
        ? "bg-warning"
        : "bg-model";
  return (
    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${color}`} />
  );
}

function statusToneForNav(status: NavItem["status"]) {
  if (status === "live") return "success" as const;
  if (status === "partial") return "warning" as const;
  return "planned" as const;
}

function memoryStats(memories: Memory[]) {
  const now = Date.now();
  return {
    active: memories.filter((memory) => memory.state === "active").length,
    confirmed: memories.filter((memory) => Boolean(memory.last_confirmed_at))
      .length,
    archived: memories.filter((memory) => memory.state === "archived").length,
    expired: memories.filter((memory) => {
      return memory.expires_at
        ? new Date(memory.expires_at).getTime() < now
        : false;
    }).length,
    preferences: memories.filter((memory) => memory.type === "preference")
      .length,
    projects: memories.filter((memory) => memory.type === "project").length,
    style: memories.filter((memory) => memory.type === "style").length,
    goals: memories.filter((memory) => memory.type === "goal").length,
  };
}

function CompanionBadges({
  memories,
  documents,
  cache,
  contextRuns,
}: {
  memories: Memory[];
  documents: DocumentItem[];
  cache: CacheList | null;
  contextRuns: ContextRun[];
}) {
  const badges: Array<{ label: string; tone: "success" | "info" | "neutral"; hint: string }> = [];
  badges.push({
    label: "No secrets stored",
    tone: "success",
    hint: "Gateway rejects common API keys, passwords, and tokens before memory write.",
  });
  if (memories.length > 0) {
    badges.push({
      label: `First memory · ${memories.length}`,
      tone: "info",
      hint: "You have at least one memory in this app/user scope.",
    });
  }
  if (documents.length > 0) {
    badges.push({
      label: `Knowledge indexed · ${documents.length}`,
      tone: "info",
      hint: "Documents are indexed and available to the context compiler.",
    });
  }
  if (contextRuns.length >= 5) {
    badges.push({
      label: "Active runtime",
      tone: "success",
      hint: `${contextRuns.length} context runs tracked.`,
    });
  }
  if ((cache?.total ?? 0) > 0) {
    badges.push({
      label: "Cache warming",
      tone: "info",
      hint: `${cache?.total ?? 0} semantic cache entries.`,
    });
  }
  return (
    <div className="flex flex-wrap gap-2" aria-label="Companion achievements">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className="chip"
          data-active={badge.tone === "success"}
          title={badge.hint}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function companionMood(
  health: Health | null,
  memories: Memory[],
  documents: DocumentItem[],
  preview: ContextPreview | null,
): {
  label: string;
  body: string;
  tone: "success" | "warning" | "info" | "planned";
} {
  if (!health || health.status !== "ok") {
    return {
      label: "Checking",
      tone: "warning",
      body: "Trying to reach the Gateway. Confirm /health is responding and that the dashboard points at the right base URL.",
    };
  }
  if (preview?.warnings.length) {
    return {
      label: "Watching",
      tone: "warning",
      body: `${preview.warnings.length} context warning${
        preview.warnings.length === 1 ? "" : "s"
      } on the latest preview. Open Security to inspect them before sending real prompts.`,
    };
  }
  if (memories.length === 0 && documents.length === 0) {
    return {
      label: "Needs setup",
      tone: "planned",
      body: "Connect a model, seed project memory, or index a file so the next AI tool has shared context.",
    };
  }
  if (!preview) {
    return {
      label: "Learning",
      tone: "info",
      body: `Tracking ${memories.length} memor${
        memories.length === 1 ? "y" : "ies"
      } and ${documents.length} document${
        documents.length === 1 ? "" : "s"
      }. Run a context preview to see what N0Tune would send.`,
    };
  }
  return {
    label: "Ready",
    tone: "success",
    body: `${memories.length} memor${
      memories.length === 1 ? "y" : "ies"
    } and ${documents.length} document${
      documents.length === 1 ? "" : "s"
    } compiled. Same model, personal context.`,
  };
}

function cacheHitRate(runs: ContextRun[]) {
  if (!runs.length) return "0%";
  const hits = runs.filter((run) => run.cache_hit).length;
  return `${Math.round((hits / runs.length) * 100)}%`;
}

function riskyChunkCount(documents: DocumentItem[]) {
  return documents.reduce(
    (total, doc) =>
      total +
      doc.chunks.filter((chunk) => chunk.injection_risk_score > 0.5).length,
    0,
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

function formatDate(value: string | null | undefined) {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString();
}
