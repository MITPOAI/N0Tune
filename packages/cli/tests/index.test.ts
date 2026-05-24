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

  it("`project detect` registers the current cwd with the gateway", async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        project_id: "proj_123",
        project_name: "demo",
        detected_root: "C:/demo",
        status: "created",
      }),
    );

    const code = await runCli(["project", "detect", "--cwd", "C:/demo", "--tool", "codex"]);
    expect(code).toBe(0);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/projects/detect");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.cwd).toBe("C:/demo");
    expect(body.tool_name).toBe("codex");
  });

  it("`memory add --project` writes a project-scoped memory", async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({ project_id: "proj_123" }));
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({ id: "mem_project", project_id: "proj_123", text: "Decision" }, 201),
    );

    const code = await runCli(["memory", "add", "--project", "--type", "decision", "Decision"]);
    expect(code).toBe(0);
    const [url, init] = mockFetch.mock.calls[1];
    expect(String(url)).toContain("/v1/projects/proj_123/memories");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.type).toBe("decision");
  });

  it("`handoff continue` prints the latest continuation prompt", async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({ project_id: "proj_123" }));
    mockFetch.mockImplementationOnce(() => jsonResponse([{ id: "hof_123" }]));
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        handoff_id: "hof_123",
        continuation_prompt: "Continue from Claude in Codex.",
      }),
    );

    const writes: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"));
        return true;
      });

    const code = await runCli(["handoff", "continue", "--target", "codex"]);
    stdoutSpy.mockRestore();
    expect(code).toBe(0);
    expect(writes.join("")).toContain("Continue from Claude in Codex.");
    expect(String(mockFetch.mock.calls[2][0])).toContain("/v1/handoffs/hof_123/continue-prompt");
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

  it("`memory consolidate --dry-run` passes dry_run=true to the gateway", async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        clusters_collapsed: 1,
        new_summary_ids: [],
        active_before: 4,
        active_after: 4,
        dry_run: true,
      }),
    );
    const code = await runCli([
      "memory",
      "consolidate",
      "--dry-run",
      "--user-id",
      "smoke",
    ]);
    expect(code).toBe(0);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/memories/consolidate");
    expect(String(url)).toContain("dry_run=true");
    expect(init?.method).toBe("POST");
    expect(logs.join("\n")).toContain('"dry_run": true');
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
