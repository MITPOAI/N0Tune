/**
 * Shared types for the Desktop app.
 *
 * Mirrors the shapes used by `@n0tune/sdk` and the Gateway API so the same
 * components can render data whether the local Rust runtime or a remote
 * Gateway is providing it.
 */

export type MemoryType =
  | "preference"
  | "goal"
  | "project"
  | "correction"
  | "style"
  | "fact";

export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama"
  | "lmstudio"
  | "compatible";

export interface ProviderConfig {
  id: ProviderId;
  /** Human-friendly label. */
  label: string;
  /** Base URL for the OpenAI-compatible endpoint. */
  baseUrl: string;
  /** Default model identifier. */
  model: string;
  /** Optional API key. Stored in the OS keychain on real Tauri builds. */
  apiKey?: string;
}

export interface StyleProfile {
  tone: string;
  depth: string;
  format: string;
  avoid: string[];
}

export interface Memory {
  id: string;
  type: MemoryType;
  text: string;
  confidence: number;
  state: "candidate" | "active" | "confirmed" | "deprecated" | "expired" | "deleted";
  scope: "user" | "session" | "project" | "team" | "org" | "app" | "global";
  created_at: string;
  updated_at: string;
}

export interface Persona {
  name: string;
  avatar: string;
  personality: string;
  style: StyleProfile;
  memoryMode: "auto" | "review" | "manual" | "off";
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ContextTraceItem {
  type: "memory" | "chunk";
  id: string;
  reason: string;
}

export interface ContextTrace {
  why_selected: ContextTraceItem[];
  excluded: ContextTraceItem[];
  selected_memories: Memory[];
  prompt_tokens_estimated: number;
  tokens_saved_estimated: number;
  warnings: string[];
}

export interface ChatResponse {
  answer: string;
  provider: string;
  trace: ContextTrace;
}

/**
 * Backend interface the React shell talks to.
 *
 * The dev build (`npm run dev`) wires a `LocalStubBackend` that operates
 * on in-memory state, so UI work isn't blocked on the Rust runtime. The
 * Tauri build (`npm run tauri:dev`) will substitute a `TauriBackend`
 * that calls into Rust via `@tauri-apps/api/invoke`.
 */
export interface DesktopBackend {
  listMemories(): Promise<Memory[]>;
  saveMemory(input: { text: string; type?: MemoryType; confidence?: number }): Promise<Memory>;
  forgetMemory(id: string): Promise<void>;

  getStyle(): Promise<StyleProfile>;
  updateStyle(input: Partial<StyleProfile>): Promise<StyleProfile>;

  getPersona(): Promise<Persona>;
  updatePersona(input: Partial<Persona>): Promise<Persona>;

  getProviderConfig(): Promise<ProviderConfig | null>;
  setProviderConfig(input: ProviderConfig): Promise<ProviderConfig>;

  chat(message: string): Promise<ChatResponse>;
}
