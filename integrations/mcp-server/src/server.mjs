#!/usr/bin/env node

import readline from "node:readline";
import { pathToFileURL } from "node:url";

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
    default:
      throw new Error(`Unknown N0Tune MCP tool: ${name}`);
  }
}

async function api(path, init = {}) {
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    void (async () => {
      if (!line.trim()) {
        return;
      }
      const message = JSON.parse(line);
      if (!message.id) {
        return;
      }
      try {
        write({ jsonrpc: "2.0", id: message.id, result: await handle(message) });
      } catch (error) {
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
}
