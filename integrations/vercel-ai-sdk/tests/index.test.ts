import { describe, expect, it } from "vitest";

import {
  buildN0TuneSystemPrompt,
  createN0TuneClient,
  createN0TuneProvider,
  n0tuneAdapterVersion,
} from "../src/index";

describe("@n0tune/vercel-ai-sdk", () => {
  it("exports the package version", () => {
    expect(n0tuneAdapterVersion).toBe("0.1.0");
  });

  it("createN0TuneClient returns a working N0TuneClient instance", () => {
    const client = createN0TuneClient({
      baseUrl: "http://n0tune.test",
      apiKey: "test-key",
    });
    expect(typeof (client as unknown as { health?: () => unknown }).health).toBe("function");
  });

  it("createN0TuneProvider returns a callable provider factory", () => {
    const provider = createN0TuneProvider({
      baseUrl: "http://n0tune.test",
      apiKey: "test-key",
      appId: "demo",
      userId: "user_1",
    });
    expect(typeof provider).toBe("function");
    const model = provider("n0tune/dev");
    expect(model).toBeDefined();
  });

  it("createN0TuneProvider points at the N0Tune /v1/openai sub-path", async () => {
    const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(
        JSON.stringify({
          id: "chatcmpl",
          object: "chat.completion",
          created: 0,
          model: "n0tune/dev",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = createN0TuneProvider({
      baseUrl: "http://n0tune.test",
      apiKey: "test-key",
      fetch: fakeFetch,
    });

    const { generateText } = await import("ai");
    await generateText({
      model: provider("n0tune/dev"),
      messages: [{ role: "user", content: "hi" }],
    });

    expect(calls.length).toBeGreaterThan(0);
    const url = String(calls[0].input);
    expect(url).toContain("http://n0tune.test/v1/openai");
    expect(url).toContain("/chat/completions");
  });

  it("buildN0TuneSystemPrompt returns compiled_context", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          compiled_context: "system text from N0Tune",
          selected_memories: [],
          selected_chunks: [],
          style_profile: {},
          cache_hit: false,
          prompt_tokens_estimated: 0,
          tokens_saved_estimated: 0,
          warnings: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const client = createN0TuneClient({ baseUrl: "http://n0tune.test", apiKey: "k" });
      const prompt = await buildN0TuneSystemPrompt({
        client,
        userId: "user_1",
        message: "Explain RAG",
      });
      expect(prompt).toBe("system text from N0Tune");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
