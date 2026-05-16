export const n0tuneVersion = "0.1.0";

export const phaseStatus = {
  phase: 7,
  implemented: [
    "health endpoint",
    "memory CRUD",
    "style profile CRUD",
    "document upload and chunks",
    "context preview",
    "chat",
    "OpenAI-compatible proxy",
  ],
  notImplemented: ["streaming OpenAI proxy", "production provider credential flow"],
} as const;

export type N0TuneClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

export type MemoryCreate = {
  app_id?: string;
  user_id: string;
  type?: "preference" | "goal" | "project" | "correction" | "style" | "fact";
  text: string;
  confidence?: number;
};

export type ContextPreviewRequest = {
  app_id?: string;
  user_id: string;
  message: string;
  model?: string;
  max_context_tokens?: number;
};

export class N0TuneClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: N0TuneClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:8000").replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  health() {
    return this.request("/health");
  }

  createMemory(payload: MemoryCreate) {
    return this.request("/v1/memories", {
      method: "POST",
      body: JSON.stringify({ app_id: "demo", ...payload }),
    });
  }

  listMemories(appId: string, userId: string, query?: string) {
    const params = new URLSearchParams({ app_id: appId, user_id: userId });
    if (query) {
      params.set("q", query);
    }
    return this.request(`/v1/memories?${params.toString()}`);
  }

  contextPreview(payload: ContextPreviewRequest) {
    return this.request("/v1/context/preview", {
      method: "POST",
      body: JSON.stringify({ app_id: "demo", max_context_tokens: 1200, ...payload }),
    });
  }

  chat(payload: ContextPreviewRequest) {
    return this.request("/v1/chat", {
      method: "POST",
      body: JSON.stringify({ app_id: "demo", max_context_tokens: 1200, ...payload }),
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.apiKey) {
      headers.set("X-N0Tune-API-Key", this.apiKey);
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(`N0Tune request failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }
}
