#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

// Optional debug log so we can diagnose Claude Code spawn failures. Writes
// to a fixed temp file rather than stderr so the host can't conflate it
// with protocol output. Enable with N0TUNE_MCP_DEBUG=1.
const DEBUG_LOG_PATH = path.join(os.tmpdir(), "n0tune-mcp-server.log");
function dlog(label, value = "") {
  if (!process.env.N0TUNE_MCP_DEBUG) return;
  try {
    fs.appendFileSync(
      DEBUG_LOG_PATH,
      `[${new Date().toISOString()}] ${label} ${
        typeof value === "string" ? value : JSON.stringify(value)
      }\n`,
    );
  } catch {
    // never block protocol traffic on a logging failure
  }
}

export const toolDefinitions = [
  {
    name: "n0tune_search_memories",
    description: "Search N0Tune memories for a user.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["user_id", "query"],
    },
  },
  {
    name: "n0tune_save_memory",
    description: "Save a safe long-term memory.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
        memory_text: { type: "string" },
        type: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["user_id", "memory_text"],
    },
  },
  {
    name: "n0tune_get_style_profile",
    description: "Read a user's compact style profile.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "n0tune_search_docs",
    description: "Search indexed N0Tune documents and chunks.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "n0tune_context_preview",
    description: "Compile context without calling a model.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
        message: { type: "string" },
        max_context_tokens: { type: "number" },
      },
      required: ["user_id", "message"],
    },
  },
  {
    name: "n0tune_forget_memory",
    description: "Soft-delete a N0Tune memory.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        memory_id: { type: "string" },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "n0tune_get_persona",
    description:
      "Read the user's compact persona shell (name + style profile + memory mode). " +
      "Does NOT include private memories.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "n0tune_alignment_check",
    description:
      "Context Guard: check whether a proposed agent response, plan, or diff " +
      "stays aligned with stored N0Tune project rules (phase scope, terminology, " +
      "security, benchmark facts, secret patterns). Returns a structured " +
      "AlignmentReport. Call this BEFORE committing claims to the user — if " +
      "`aligned: false`, revise the plan first.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        user_id: { type: "string" },
        phase: { type: "string", description: "Current roadmap phase, e.g. 'CG-1'." },
        content: { type: "string", description: "The proposed response or plan." },
        claims: {
          type: "array",
          items: { type: "string" },
          description: "Optional explicit list of factual claims the response makes.",
        },
        changed_files: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of files the agent intends to change.",
        },
        strict: {
          type: "boolean",
          description: "Treat medium-severity findings as blockers (default false).",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "n0tune_project_detect",
    description: "Detect/register the current project folder for cross-tool context.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        cwd: { type: "string" },
        tool_name: { type: "string" },
      },
      required: ["cwd"],
    },
  },
  {
    name: "n0tune_get_project_context",
    description: "Get project-scoped memories, docs, handoffs, and current tasks.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        query: { type: "string" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "n0tune_create_handoff_capsule",
    description: "Create a project Handoff Capsule so another AI tool can continue.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        source_tool: { type: "string" },
        target_tool: { type: "string" },
        session_id: { type: "string" },
        title: { type: "string" },
        goal: { type: "string" },
        current_state: { type: "string" },
        decisions: { type: "array", items: { type: "string" } },
        files_changed: { type: "array", items: { type: "string" } },
        commands_run: { type: "array", items: { type: "string" } },
        errors_seen: { type: "array", items: { type: "string" } },
        tests_run: { type: "array", items: { type: "string" } },
        next_steps: { type: "array", items: { type: "string" } },
        open_questions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        memory_refs: { type: "array", items: { type: "string" } },
        doc_refs: { type: "array", items: { type: "string" } },
      },
      required: ["project_id", "source_tool", "current_state"],
    },
  },
  {
    name: "n0tune_get_latest_handoff",
    description: "Get the newest Handoff Capsule for a project.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        source_tool: { type: "string" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "n0tune_list_handoffs",
    description: "List project Handoff Capsules.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        source_tool: { type: "string" },
        limit: { type: "number" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "n0tune_continue_from_handoff",
    description: "Generate a continuation prompt from a Handoff Capsule.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        handoff_id: { type: "string" },
        target_tool: { type: "string" },
      },
      required: ["handoff_id"],
    },
  },
  {
    name: "n0tune_save_project_memory",
    description: "Save a project-scoped memory for the detected project.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        user_id: { type: "string" },
        memory: { type: "string" },
        type: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["project_id", "memory"],
    },
  },
  {
    name: "n0tune_search_project_memory",
    description: "Search memories scoped to one project; does not search all projects.",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string" },
        project_id: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["project_id", "query"],
    },
  },
];

const apiBaseUrl = process.env.N0TUNE_API_BASE_URL ?? "http://localhost:8000";
const defaultAppId = process.env.N0TUNE_APP_ID ?? "demo";
const apiKey = process.env.N0TUNE_API_KEY;

export async function callTool(name, args = {}) {
  switch (name) {
    case "n0tune_search_memories": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
        user_id: args.user_id,
        q: args.query,
        limit: String(args.limit ?? 10),
      });
      return api(`/v1/memories?${params.toString()}`);
    }
    case "n0tune_save_memory":
      return api("/v1/memories", {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          user_id: args.user_id,
          type: args.type ?? "fact",
          text: args.memory_text,
          confidence: args.confidence ?? 0.8,
        },
      });
    case "n0tune_get_style_profile":
      return api(`/v1/users/${args.user_id}/style?app_id=${encodeURIComponent(args.app_id ?? defaultAppId)}`);
    case "n0tune_search_docs": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
        q: args.query,
      });
      return api(`/v1/documents?${params.toString()}`);
    }
    case "n0tune_context_preview":
      return api("/v1/context/preview", {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          user_id: args.user_id,
          message: args.message,
          max_context_tokens: args.max_context_tokens ?? 1200,
        },
      });
    case "n0tune_forget_memory":
      return api(`/v1/memories/${args.memory_id}?app_id=${encodeURIComponent(args.app_id ?? defaultAppId)}`, {
        method: "DELETE",
      });
    case "n0tune_get_persona": {
      // Persona = style profile + the user's saved name/avatar metadata
      // when the Desktop persona endpoint lands. For now we return the
      // style profile so MCP clients can call this tool today.
      const style = await api(
        `/v1/users/${args.user_id}/style?app_id=${encodeURIComponent(
          args.app_id ?? defaultAppId,
        )}`,
      );
      return {
        format: "n0tune-persona",
        version: 1,
        user_id: args.user_id,
        style,
        notes:
          "MCP get_persona returns the public persona shell. Private memories are " +
          "NOT included; use n0tune_search_memories with explicit consent for those.",
      };
    }
    case "n0tune_alignment_check":
      // Context Guard. POST the proposed content to the Gateway's
      // /v1/alignment/check; the engine runs deterministically against
      // the stored rules for this app and returns an AlignmentReport.
      return api("/v1/alignment/check", {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          user_id: args.user_id ?? "claude-code",
          phase: args.phase,
          content: args.content ?? "",
          claims: Array.isArray(args.claims) ? args.claims : [],
          changed_files: Array.isArray(args.changed_files) ? args.changed_files : [],
          strict: Boolean(args.strict),
        },
      });
    case "n0tune_project_detect":
      return api("/v1/projects/detect", {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          cwd: args.cwd,
          tool_name: args.tool_name ?? "mcp",
        },
      });
    case "n0tune_get_project_context": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
      });
      if (args.query) params.set("query", args.query);
      return api(`/v1/projects/${encodeURIComponent(args.project_id)}/context?${params.toString()}`);
    }
    case "n0tune_create_handoff_capsule":
      return api(`/v1/projects/${encodeURIComponent(args.project_id)}/handoffs`, {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          source_tool: args.source_tool,
          target_tool: args.target_tool,
          session_id: args.session_id,
          title: args.title,
          goal: args.goal,
          current_state: args.current_state,
          decisions: arrayArg(args.decisions),
          files_changed: arrayArg(args.files_changed),
          commands_run: arrayArg(args.commands_run),
          errors_seen: arrayArg(args.errors_seen),
          tests_run: arrayArg(args.tests_run),
          next_steps: arrayArg(args.next_steps),
          open_questions: arrayArg(args.open_questions),
          warnings: arrayArg(args.warnings),
          memory_refs: arrayArg(args.memory_refs),
          doc_refs: arrayArg(args.doc_refs),
        },
      });
    case "n0tune_get_latest_handoff": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
        limit: "1",
      });
      if (args.source_tool) params.set("source_tool", args.source_tool);
      const rows = await api(
        `/v1/projects/${encodeURIComponent(args.project_id)}/handoffs?${params.toString()}`,
      );
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    }
    case "n0tune_list_handoffs": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
        limit: String(args.limit ?? 20),
      });
      if (args.source_tool) params.set("source_tool", args.source_tool);
      return api(`/v1/projects/${encodeURIComponent(args.project_id)}/handoffs?${params.toString()}`);
    }
    case "n0tune_continue_from_handoff":
      return api(`/v1/handoffs/${encodeURIComponent(args.handoff_id)}/continue-prompt`, {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          target_tool: args.target_tool,
        },
      });
    case "n0tune_save_project_memory":
      return api(`/v1/projects/${encodeURIComponent(args.project_id)}/memories`, {
        method: "POST",
        body: {
          app_id: args.app_id ?? defaultAppId,
          user_id: args.user_id ?? "mcp",
          type: args.type ?? "project",
          text: args.memory,
          confidence: args.confidence ?? 0.86,
        },
      });
    case "n0tune_search_project_memory": {
      const params = new URLSearchParams({
        app_id: args.app_id ?? defaultAppId,
        q: args.query,
        limit: String(args.limit ?? 10),
      });
      return api(`/v1/projects/${encodeURIComponent(args.project_id)}/memories?${params.toString()}`);
    }
    default:
      throw new Error(`Unknown N0Tune MCP tool: ${name}`);
  }
}

async function api(path, init = {}) {
  assertLocalMcpUrl();
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-N0Tune-API-Key"] = apiKey;
  }
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(body));
  }
  return body;
}

function arrayArg(value) {
  return Array.isArray(value) ? value : [];
}

function assertLocalMcpUrl() {
  if (process.env.N0TUNE_MCP_ALLOW_REMOTE === "1") return;
  const parsed = new URL(apiBaseUrl);
  const host = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return;
  throw new Error("N0Tune MCP is local-only by default. Set N0TUNE_MCP_ALLOW_REMOTE=1 to opt into remote Gateway access.");
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "n0tune-mcp-server", version: "0.1.0" },
    };
  }
  if (message.method === "tools/list") {
    return { tools: toolDefinitions };
  }
  if (message.method === "tools/call") {
    const result = await callTool(message.params?.name, message.params?.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  return {};
}

// True when this file is the process entry point (i.e. invoked as
// `node server.mjs`), not when imported by tests.
//
// We can't just compare `import.meta.url === pathToFileURL(process.argv[1]).href`
// because on Windows, identical paths can differ by:
//   * URL-encoding of spaces (e.g. "IMME internal" → "IMME%20internal")
//   * case (drive letters, mixed slashes)
//   * realpath resolution through Claude Code's spawn wrapper
// Any of those mismatches and the readline loop never starts, which is
// the textbook "MCP server failed to connect" symptom.
function isProcessEntry() {
  if (!process.argv[1]) return false;
  try {
    const here = path.normalize(fileURLToPath(import.meta.url)).toLowerCase();
    const argv = path.normalize(process.argv[1]).toLowerCase();
    if (here === argv) return true;
    // Realpath fallback covers symlinks + 8.3 short names on Windows.
    return (
      fs.realpathSync(fileURLToPath(import.meta.url)).toLowerCase() ===
      fs.realpathSync(process.argv[1]).toLowerCase()
    );
  } catch {
    return false;
  }
}

if (isProcessEntry()) {
  dlog("startup", {
    argv: process.argv,
    cwd: process.cwd(),
    apiBaseUrl,
    appId: defaultAppId,
    hasKey: Boolean(apiKey),
  });
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    void (async () => {
      if (!line.trim()) {
        return;
      }
      let message;
      try {
        message = JSON.parse(line);
      } catch (err) {
        dlog("parse error", { line, err: String(err) });
        return;
      }
      // JSON-RPC notifications (no id) — e.g. `notifications/initialized`,
      // which Claude Code sends right after `initialize`. They must NOT
      // get a reply; just acknowledge by returning early.
      if (message.id === undefined || message.id === null) {
        dlog("notification", { method: message.method });
        return;
      }
      try {
        const result = await handle(message);
        write({ jsonrpc: "2.0", id: message.id, result });
      } catch (error) {
        dlog("handler error", {
          method: message.method,
          err: error instanceof Error ? error.message : String(error),
        });
        write({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : "Unknown MCP server error",
          },
        });
      }
    })();
  });
  // Don't exit the process when stdin closes; Claude Code sends EOF on
  // some lifecycle events and we want the readline loop to keep running.
  process.stdin.on("end", () => dlog("stdin end", "(staying alive)"));
}
