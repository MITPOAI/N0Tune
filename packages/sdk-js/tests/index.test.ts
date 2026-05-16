import { describe, expect, it } from "vitest";

import { N0TuneClient, n0tuneVersion, phaseStatus } from "../src/index";

describe("@n0tune/sdk Phase 0 metadata", () => {
  it("exports the current package version", () => {
    expect(n0tuneVersion).toBe("0.1.0");
  });

  it("exports MVP phase status", () => {
    expect(phaseStatus.phase).toBe(7);
    expect(phaseStatus.implemented).toContain("context preview");
  });

  it("builds API requests with the configured base URL", async () => {
    const calls: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const client = new N0TuneClient({ baseUrl: "http://n0tune.test/", apiKey: "local" });
      await client.createMemory({ user_id: "user_1", text: "User likes short answers." });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject([
        "http://n0tune.test/v1/memories",
        { method: "POST" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
