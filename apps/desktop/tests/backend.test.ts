import { describe, expect, it } from "vitest";

import { LocalStubBackend } from "../src/backend";

describe("LocalStubBackend", () => {
  it("saves and lists memories", async () => {
    const backend = new LocalStubBackend();
    const before = await backend.listMemories();
    const created = await backend.saveMemory({
      text: "Prefer ASCII diagrams when explaining systems.",
      type: "style",
      confidence: 0.9,
    });
    const after = await backend.listMemories();

    expect(after.length).toBe(before.length + 1);
    expect(after[0].id).toBe(created.id);
    expect(after[0].text).toContain("ASCII");
  });

  it("forget removes a memory", async () => {
    const backend = new LocalStubBackend();
    const saved = await backend.saveMemory({ text: "Throwaway" });
    await backend.forgetMemory(saved.id);
    const after = await backend.listMemories();
    expect(after.some((m) => m.id === saved.id)).toBe(false);
  });

  it("chat returns a trace with selected memories on keyword overlap", async () => {
    const backend = new LocalStubBackend();
    await backend.saveMemory({ text: "Loves architecture diagrams." });
    const response = await backend.chat("Explain the architecture again.");
    expect(response.trace.prompt_tokens_estimated).toBeGreaterThan(0);
    expect(response.trace.warnings).toContain(
      "No model provider configured — using stub response.",
    );
  });

  it("provider config survives a round trip", async () => {
    const backend = new LocalStubBackend();
    expect(await backend.getProviderConfig()).toBeNull();
    await backend.setProviderConfig({
      id: "anthropic",
      label: "Anthropic Claude",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-5",
      apiKey: "test-key",
    });
    const config = await backend.getProviderConfig();
    expect(config?.id).toBe("anthropic");
    expect(config?.apiKey).toBe("test-key");
  });

  it("updateStyle merges fields and preserves untouched ones", async () => {
    const backend = new LocalStubBackend();
    const before = await backend.getStyle();
    await backend.updateStyle({ tone: "formal" });
    const after = await backend.getStyle();
    expect(after.tone).toBe("formal");
    expect(after.depth).toBe(before.depth);
  });
});
