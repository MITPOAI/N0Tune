import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalBackend } from "../src/backend";

beforeEach(() => {
  // jsdom-provided localStorage; clear between tests so each starts fresh.
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("LocalBackend", () => {
  it("saves and lists memories, and persists to localStorage", async () => {
    const backend = new LocalBackend();
    const before = await backend.listMemories();
    const created = await backend.saveMemory({
      text: "Prefer ASCII diagrams when explaining systems.",
      type: "style",
      confidence: 0.9,
    });
    const after = await backend.listMemories();

    expect(after.length).toBe(before.length + 1);
    expect(after[0].id).toBe(created.id);

    const reloaded = new LocalBackend();
    const list = await reloaded.listMemories();
    expect(list.find((memory) => memory.id === created.id)).toBeTruthy();
  });

  it("rejects memory text that looks like a secret", async () => {
    const backend = new LocalBackend();
    await expect(
      backend.saveMemory({ text: "my key is sk-abcdef0123456789012345" }),
    ).rejects.toThrow(/secret/);
  });

  it("forget removes a memory and persists the removal", async () => {
    const backend = new LocalBackend();
    const saved = await backend.saveMemory({ text: "Throwaway" });
    await backend.forgetMemory(saved.id);

    const reloaded = new LocalBackend();
    const after = await reloaded.listMemories();
    expect(after.some((m) => m.id === saved.id)).toBe(false);
  });

  it("chat with no provider configured emits a stub answer with a clear warning", async () => {
    const backend = new LocalBackend();
    await backend.saveMemory({ text: "Loves architecture diagrams." });
    const response = await backend.chat("Explain the architecture again.");
    expect(response.provider).toBe("stub");
    expect(response.trace.prompt_tokens_estimated).toBeGreaterThan(0);
    expect(response.trace.warnings).toContain(
      "No model provider configured — using a local stub response.",
    );
  });

  it("chat calls the configured OpenAI-compatible provider via fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "ack from openai" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new LocalBackend();
    await backend.setProviderConfig({
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-test-only-mock-abcdefghijklmnop",
    });

    const response = await backend.chat("Walk me through context-tuning.");
    expect(response.answer).toBe("ack from openai");
    expect(response.provider).toBe("gpt-4o-mini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toBe("Walk me through context-tuning.");
  });

  it("chat routes anthropic providers to /v1/messages with the x-api-key header", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ content: [{ type: "text", text: "hi from claude" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new LocalBackend();
    await backend.setProviderConfig({
      id: "anthropic",
      label: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-mock-only-abcdefghijklmnop",
    });
    const response = await backend.chat("hello");
    expect(response.answer).toBe("hi from claude");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe(
      "sk-ant-mock-only-abcdefghijklmnop",
    );
  });

  it("auto memory mode extracts a memory from 'remember …' messages", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "noted." } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new LocalBackend();
    await backend.setProviderConfig({
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-test-abcdefghijklmnop",
    });
    const before = await backend.listMemories();
    await backend.chat("Remember I work in PDT and answer in 24-hour time.");
    const after = await backend.listMemories();
    expect(after.length).toBe(before.length + 1);
    expect(after[0].text).toContain("PDT");
  });
});
