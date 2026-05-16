import { createOpenAI } from "@ai-sdk/openai";
import { N0TuneClient } from "@n0tune/sdk";

export const n0tuneAdapterVersion = "0.1.0";

export type N0TuneAdapterOptions = {
  /** Base URL of the N0Tune API (e.g. http://localhost:8000). */
  baseUrl: string;
  /** App API key. Sent as both Authorization Bearer and X-N0Tune-API-Key. */
  apiKey?: string;
  /** App id. Defaults to "demo". */
  appId?: string;
  /** End-user id N0Tune scopes memories and cache by. */
  userId?: string;
  /** Optional fetch override. Useful for tests and edge runtimes. */
  fetch?: typeof fetch;
};

/**
 * Build a Vercel AI SDK provider that targets N0Tune's OpenAI-compatible
 * endpoint at `${baseUrl}/v1/openai`. Use the returned provider exactly like
 * the official `openai` provider — `generateText`, `streamText`, etc.
 *
 *     const n0tune = createN0TuneProvider({ baseUrl, apiKey });
 *     await streamText({ model: n0tune("n0tune/dev"), messages });
 */
export function createN0TuneProvider(options: N0TuneAdapterOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers["X-N0Tune-API-Key"] = options.apiKey;
  }
  if (options.appId) {
    headers["X-N0Tune-App-ID"] = options.appId;
  }
  if (options.userId) {
    headers["X-N0Tune-User-ID"] = options.userId;
  }
  return createOpenAI({
    baseURL: `${baseUrl}/v1/openai`,
    apiKey: options.apiKey,
    headers,
    fetch: options.fetch,
  });
}

/**
 * Build a JSON-serialisable client for the rest of the N0Tune REST API:
 * memories, style profile, documents, context preview, and cache.
 *
 * This is just a re-export of `@n0tune/sdk`'s client, keyed off the same
 * `baseUrl` and `apiKey` you pass to `createN0TuneProvider`, so you can use
 * one set of credentials for both the LLM call and the surrounding context.
 */
export function createN0TuneClient(options: N0TuneAdapterOptions): N0TuneClient {
  return new N0TuneClient({ baseUrl: options.baseUrl, apiKey: options.apiKey });
}

/**
 * Fetch the compiled context from N0Tune and return it as a system-prompt
 * string. Useful when you want a model provider other than N0Tune's proxy but
 * still want N0Tune to choose the memories and chunks.
 */
export async function buildN0TuneSystemPrompt(input: {
  client: N0TuneClient;
  userId: string;
  message: string;
  appId?: string;
  maxContextTokens?: number;
}): Promise<string> {
  const preview = (await input.client.contextPreview({
    user_id: input.userId,
    message: input.message,
    app_id: input.appId ?? "demo",
    max_context_tokens: input.maxContextTokens ?? 1200,
  })) as { compiled_context?: string };
  return preview.compiled_context ?? "";
}
