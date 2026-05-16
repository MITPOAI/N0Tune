/**
 * Provider client used by the Desktop renderer.
 *
 * Mirrors the Gateway's Python provider router (apps/api/app/services/providers/router.py)
 * so the Desktop and Gateway behave identically. Three wire shapes:
 *
 *   - openai      → OpenAI / OpenRouter / Ollama / LM Studio / vLLM / anything
 *                   that speaks `/chat/completions`.
 *   - anthropic   → Anthropic Messages API (`/v1/messages`).
 *   - gemini      → Google Gemini `generateContent` REST shape.
 *
 * Selection is driven by `ProviderConfig.id`: `openai`, `anthropic`,
 * `gemini`, `openrouter`, `ollama`, `lmstudio`, `compatible`. The last
 * four all route through the openai-compatible path.
 */

import type { ProviderConfig } from "./types";

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

const ANTHROPIC_VERSION = "2023-06-01";

export async function callProvider(
  config: ProviderConfig,
  compiledContext: string,
  message: string,
  options: { signal?: AbortSignal } = {},
): Promise<{ answer: string; provider: string }> {
  switch (config.id) {
    case "anthropic":
      return callAnthropic(config, compiledContext, message, options.signal);
    case "gemini":
      return callGemini(config, compiledContext, message, options.signal);
    case "openai":
    case "openrouter":
    case "ollama":
    case "lmstudio":
    case "compatible":
    default:
      return callOpenAICompatible(config, compiledContext, message, options.signal);
  }
}

async function callOpenAICompatible(
  config: ProviderConfig,
  compiledContext: string,
  message: string,
  signal?: AbortSignal,
): Promise<{ answer: string; provider: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.id === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/n0tune/n0tune";
    headers["X-Title"] = "N0Tune Desktop";
  }

  const url = `${stripSlash(config.baseUrl)}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: compiledContext },
        { role: "user", content: message },
      ],
    }),
  });
  const body = (await readJson(response)) as {
    choices?: { message?: { content?: string } }[];
  };
  if (!response.ok) {
    throw new ProviderError(`${config.label} returned HTTP ${response.status}`, response.status, body);
  }
  const answer = body?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || answer.length === 0) {
    throw new ProviderError(`${config.label} response missing choices[0].message.content`, undefined, body);
  }
  return { answer, provider: config.model };
}

async function callAnthropic(
  config: ProviderConfig,
  compiledContext: string,
  message: string,
  signal?: AbortSignal,
): Promise<{ answer: string; provider: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (config.apiKey) headers["x-api-key"] = config.apiKey;

  const url = `${stripSlash(config.baseUrl)}/v1/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      system: compiledContext,
      max_tokens: 1024,
      messages: [{ role: "user", content: message }],
    }),
  });
  const body = (await readJson(response)) as {
    content?: { type: string; text?: string }[];
  };
  if (!response.ok) {
    throw new ProviderError(`Anthropic returned HTTP ${response.status}`, response.status, body);
  }
  const text = (body?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (!text) {
    throw new ProviderError("Anthropic response had no text block", undefined, body);
  }
  return { answer: text, provider: config.model };
}

async function callGemini(
  config: ProviderConfig,
  compiledContext: string,
  message: string,
  signal?: AbortSignal,
): Promise<{ answer: string; provider: string }> {
  if (!config.apiKey) {
    throw new ProviderError("Gemini requires an API key");
  }
  const url = `${stripSlash(config.baseUrl)}/models/${encodeURIComponent(
    config.model,
  )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: compiledContext }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
    }),
  });
  const body = (await readJson(response)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!response.ok) {
    throw new ProviderError(`Gemini returned HTTP ${response.status}`, response.status, body);
  }
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const answer = parts.map((part) => part.text ?? "").join("");
  if (!answer) {
    throw new ProviderError("Gemini response had no text parts", undefined, body);
  }
  return { answer, provider: config.model };
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
