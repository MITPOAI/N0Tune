/**
 * Thin Gateway wrappers used by the popup + background worker.
 *
 * Deliberately NOT using @n0tune/sdk here — that package targets
 * Node + bundlers with stricter assumptions. The extension only needs
 * three endpoints (health, context preview, memory create), so we
 * inline fetch calls instead of pulling the whole SDK into the
 * extension bundle.
 *
 * If the SDK gains a browser-safe build later, switch to it.
 */

import type { ExtensionConfig } from "./config";

export type ContextPreview = {
  compiled_context: string;
  selected_memories: Array<{ id: string; text: string; type: string }>;
  selected_chunks: Array<{ id: string; text: string }>;
  prompt_tokens_estimated: number;
  tokens_saved_estimated: number;
  cache_hit: boolean;
};

function headersFor(config: Pick<ExtensionConfig, "apiKey">): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) h["X-N0Tune-API-Key"] = config.apiKey;
  return h;
}

function trimUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export async function healthcheck(gatewayUrl: string): Promise<void> {
  const res = await fetch(`${trimUrl(gatewayUrl)}/health`);
  if (!res.ok) throw new Error(`Gateway HTTP ${res.status}`);
  const data = (await res.json()) as { status?: string };
  if (data.status !== "ok") {
    throw new Error(`Gateway status: ${data.status ?? "unknown"}`);
  }
}

export async function compileContext(
  config: ExtensionConfig,
  message: string,
  maxTokens = 1200,
): Promise<ContextPreview> {
  const res = await fetch(`${trimUrl(config.gatewayUrl)}/v1/context/preview`, {
    method: "POST",
    headers: headersFor(config),
    body: JSON.stringify({
      app_id: config.appId,
      user_id: config.userId,
      message,
      max_context_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    throw new Error(`/v1/context/preview HTTP ${res.status}`);
  }
  return (await res.json()) as ContextPreview;
}

export async function saveMemory(
  config: ExtensionConfig,
  text: string,
  type = "preference",
): Promise<{ id: string }> {
  const res = await fetch(`${trimUrl(config.gatewayUrl)}/v1/memories`, {
    method: "POST",
    headers: headersFor(config),
    body: JSON.stringify({
      app_id: config.appId,
      user_id: config.userId,
      type,
      text,
      confidence: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`/v1/memories HTTP ${res.status}`);
  return (await res.json()) as { id: string };
}
