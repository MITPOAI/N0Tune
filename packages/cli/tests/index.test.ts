import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error — pure JS module
import { runCli } from "../src/index.mjs";

type MockFetch = ReturnType<typeof vi.fn>;

const originalFetch = globalThis.fetch;
let mockFetch: MockFetch;
let logs: string[] = [];
let errors: string[] = [];
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logs = [];
  errors = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map((entry) => String(entry)).join(" "));
  });
  errSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map((entry) => String(entry)).join(" "));
  });
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("n0tune CLI", () => {
  it("--help prints the usage banner", async () => {
    const code = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("n0tune <command>");
  });

  it("`doctor` reports gateway health and memory + document counts", async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({ status: "ok", dependencies: { database: "ok", redis: "ok" } }),
    );
    mockFetch.mockImplementationOnce(() => jsonResponse([{ id: "mem_1" }, { id: "mem_2" }]));
    mockFetch.mockImplementationOnce(() => jsonResponse([{ id: "doc_1" }]));

    const code = await runCli(["doctor", "--base-url", "http://gw.test"]);
    expect(code).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("gateway    : ok");
    expect(output).toContain("memories   : 2");
    expect(output).toContain("documents  : 1");
  });

  it("`doctor` fails fast when the gateway is unreachable", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error("ECONNREFUSED")));

    const code = await runCli(["doctor", "--base-url", "http://gw.test"]);
    expect(code).toBe(1);
    expect(logs.join("\n")).toContain("unreachable");
  });

  it("`mcp install` prints a Claude Desktop config snippet", async () => {
    const code = await runCli(["mcp", "install"]);
    expect(code).toBe(0);
    const output = logs.join("\n");
    expect(output).toContain("mcpServers");
    expect(output).toContain("n0tune");
  });

  it("`memory add` requires text", async () => {
    const code = await runCli(["memory", "add"]);
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("missing text");
  });

  it("`memory add` POSTs to /v1/memories", async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({ id: "mem_new", text: "hi", confidence: 0.85 }, 201),
    );
    const code = await runCli(["memory", "add", "hello", "world"]);
    expect(code).toBe(0);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/memories");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.text).toBe("hello world");
  });

  it("`compile` prints the compiled_context to stdout", async () => {
    const compiledBody = "System: stub compiled context for tests\nUser message: Explain X.";
    mockFetch.mockImplementationOnce(() => jsonResponse({ compiled_context: compiledBody }));

    const writes: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"));
        return true;
      });

    const code = await runCli(["compile", "Explain", "X."]);
    stdoutSpy.mockRestore();
    expect(code).toBe(0);
    expect(writes.join("")).toContain("System: stub compiled context for tests");

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/context/preview");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.message).toBe("Explain X.");
  });

  it("`compile` errors when no message is provided", async () => {
    const code = await runCli(["compile"]);
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("missing <message>");
  });

  it("`persona import` rejects a non-n0tune file", async () => {
    const { writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const path = join(tmpdir(), `bad-${Date.now()}.json`);
    await writeFile(path, JSON.stringify({ format: "other" }), "utf-8");
    const code = await runCli(["persona", "import", path]);
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("not a recognized .n0tune file");
  });
});
