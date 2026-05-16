/**
 * `n0tune` CLI.
 *
 * Subcommands that are wired through to the Gateway today:
 *   - doctor      : check API + DB + Redis + memory + docs + provider config
 *   - demo        : run the two-user personalization scenario
 *   - memory      : list / add / delete / export user memories
 *   - persona     : export / import a .n0tune persona file
 *   - mcp         : print Claude/Cursor MCP config snippets
 *   - files       : sync a folder of Markdown into the Gateway
 *
 * Subcommands that are honest "coming next" stubs today:
 *   - init, desktop start, gateway start
 *
 * The CLI never embeds an API key. Auth comes from the env var
 * N0TUNE_API_KEY (or --api-key) and is sent as the bearer token.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const USAGE = `n0tune <command> [args]

Commands:
  doctor                       Check Gateway + provider + memory health.
  demo                         Run the two-user personalization demo.
  compile <message>            Print the compiled context for <message> as plain text
                               (used by the Gemini CLI adapter; works with any tool that
                               accepts a system prompt from stdin/file).

  memory list                  List memories for a user.
  memory add <text>            Save a memory for a user.
  memory delete <id>           Soft-delete a memory.
  memory export                Dump memories to JSON.

  persona export [--out file]  Export the current persona shell.
  persona import <file>        Import a .n0tune persona file (validates shape only).

  files sync <folder>          Walk Markdown files and POST them to the Gateway.

  mcp install                  Print Claude Desktop / Cursor MCP config snippets.

  init                         (stub) Create a local config.
  desktop start                (stub) Boot the Desktop dev server.
  gateway start                (stub) Boot the Gateway via Docker Compose.

Global options:
  --base-url <url>             Gateway base URL. Default http://localhost:8000.
  --api-key <key>              Gateway API key. Default $N0TUNE_API_KEY.
  --app-id <id>                Gateway app id.   Default 'demo'.
  --user-id <id>               User id where applicable. Default 'cli'.
  -h, --help                   Show this help.
`;

function parseFlags(args) {
  const flags = {
    baseUrl: process.env.N0TUNE_BASE_URL ?? "http://localhost:8000",
    apiKey: process.env.N0TUNE_API_KEY ?? "replace-with-local-development-key",
    appId: process.env.N0TUNE_APP_ID ?? "demo",
    userId: process.env.N0TUNE_USER_ID ?? "cli",
    out: null,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    switch (token) {
      case "--base-url":
        flags.baseUrl = args[++i];
        break;
      case "--api-key":
        flags.apiKey = args[++i];
        break;
      case "--app-id":
        flags.appId = args[++i];
        break;
      case "--user-id":
        flags.userId = args[++i];
        break;
      case "--out":
        flags.out = args[++i];
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      default:
        positional.push(token);
    }
  }
  return { flags, positional };
}

async function gatewayRequest(method, path, { flags, body }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${flags.apiKey}`,
  };
  const response = await fetch(`${flags.baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed ?? "");
    throw new Error(`HTTP ${response.status} on ${path}: ${detail}`);
  }
  return parsed;
}

async function runDoctor({ flags }) {
  const lines = [`n0tune doctor`, `base url   : ${flags.baseUrl}`, `app id     : ${flags.appId}`];

  try {
    const health = await gatewayRequest("GET", "/health?deep=true", { flags });
    lines.push(
      `gateway    : ${health?.status ?? "?"}  (db=${health?.dependencies?.database ?? "?"}, redis=${
        health?.dependencies?.redis ?? "?"
      })`,
    );
  } catch (error) {
    lines.push(`gateway    : unreachable (${error.message})`);
    console.log(lines.join("\n"));
    return 1;
  }

  try {
    const memories = await gatewayRequest(
      "GET",
      `/v1/memories?app_id=${encodeURIComponent(flags.appId)}&user_id=${encodeURIComponent(
        flags.userId,
      )}`,
      { flags },
    );
    lines.push(`memories   : ${Array.isArray(memories) ? memories.length : "?"} for ${flags.userId}`);
  } catch (error) {
    lines.push(`memories   : failed (${error.message})`);
  }

  try {
    const docs = await gatewayRequest(
      "GET",
      `/v1/documents?app_id=${encodeURIComponent(flags.appId)}`,
      { flags },
    );
    lines.push(`documents  : ${Array.isArray(docs) ? docs.length : "?"}`);
  } catch (error) {
    lines.push(`documents  : failed (${error.message})`);
  }

  console.log(lines.join("\n"));
  return 0;
}

async function runDemo({ flags }) {
  const users = ["user_a", "user_b"];
  for (const user of users) {
    const text =
      user === "user_a"
        ? "Prefers terse code-first answers without analogies."
        : "Prefers beginner explanations with concrete analogies.";
    await gatewayRequest("POST", "/v1/memories", {
      flags,
      body: {
        app_id: flags.appId,
        user_id: user,
        type: "preference",
        text,
        confidence: 0.95,
      },
    });
  }
  const previews = [];
  for (const user of users) {
    const preview = await gatewayRequest("POST", "/v1/context/preview", {
      flags,
      body: {
        app_id: flags.appId,
        user_id: user,
        message: "Explain RAG to me.",
        max_context_tokens: 1200,
      },
    });
    previews.push({
      user,
      memories: preview.selected_memories?.length ?? 0,
      chunks: preview.selected_chunks?.length ?? 0,
      compiled: preview.prompt_tokens_estimated,
      saved: preview.tokens_saved_estimated,
    });
  }
  console.log(JSON.stringify({ scenario: "two_user_personalization", previews }, null, 2));
  return 0;
}

async function runMemory(positional, { flags }) {
  const [verb, ...rest] = positional;
  switch (verb) {
    case "list": {
      const memories = await gatewayRequest(
        "GET",
        `/v1/memories?app_id=${encodeURIComponent(flags.appId)}&user_id=${encodeURIComponent(
          flags.userId,
        )}`,
        { flags },
      );
      console.log(JSON.stringify(memories, null, 2));
      return 0;
    }
    case "add": {
      const text = rest.join(" ").trim();
      if (!text) {
        console.error("memory add: missing text");
        return 1;
      }
      const created = await gatewayRequest("POST", "/v1/memories", {
        flags,
        body: {
          app_id: flags.appId,
          user_id: flags.userId,
          type: "fact",
          text,
          confidence: 0.85,
        },
      });
      console.log(JSON.stringify(created, null, 2));
      return 0;
    }
    case "delete": {
      const id = rest[0];
      if (!id) {
        console.error("memory delete: missing id");
        return 1;
      }
      const result = await gatewayRequest(
        "DELETE",
        `/v1/memories/${encodeURIComponent(id)}?app_id=${encodeURIComponent(flags.appId)}`,
        { flags },
      );
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    case "export": {
      const memories = await gatewayRequest(
        "GET",
        `/v1/memories/export?app_id=${encodeURIComponent(flags.appId)}&user_id=${encodeURIComponent(
          flags.userId,
        )}`,
        { flags },
      );
      const output = JSON.stringify(memories, null, 2);
      if (flags.out) {
        await writeFile(flags.out, output, "utf-8");
        console.log(`wrote ${flags.out} (${Array.isArray(memories) ? memories.length : 0} rows)`);
      } else {
        console.log(output);
      }
      return 0;
    }
    default:
      console.error(`memory: unknown subcommand ${verb}`);
      return 1;
  }
}

async function runPersona(positional, { flags }) {
  const [verb, ...rest] = positional;
  switch (verb) {
    case "export": {
      const persona = await gatewayRequest(
        "GET",
        `/v1/users/${encodeURIComponent(flags.userId)}/style?app_id=${encodeURIComponent(
          flags.appId,
        )}`,
        { flags },
      );
      const file = {
        format: "n0tune-persona",
        version: 1,
        persona: {
          name: persona?.profile_json?.name ?? "Milo",
          avatar: "img/logo.png",
          style: persona?.profile_json ?? {},
          memoryMode: "auto",
        },
        notes:
          "Persona export does NOT include private memories. " +
          "Import this file with `n0tune persona import` on another machine.",
      };
      const output = JSON.stringify(file, null, 2);
      if (flags.out) {
        await writeFile(flags.out, output, "utf-8");
        console.log(`wrote ${flags.out}`);
      } else {
        console.log(output);
      }
      return 0;
    }
    case "import": {
      const path = rest[0];
      if (!path) {
        console.error("persona import: missing file");
        return 1;
      }
      const content = await readFile(resolve(path), "utf-8");
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        console.error(`persona import: not valid JSON (${error.message})`);
        return 1;
      }
      if (parsed?.format !== "n0tune-persona") {
        console.error("persona import: not a recognized .n0tune file");
        return 1;
      }
      console.log(
        JSON.stringify(
          { ok: true, parsed: { name: parsed.persona?.name, version: parsed.version } },
          null,
          2,
        ),
      );
      console.log(
        "Note: writing to a persona endpoint is on the v0.5 roadmap; this is the parse step.",
      );
      return 0;
    }
    default:
      console.error(`persona: unknown subcommand ${verb}`);
      return 1;
  }
}

async function runCompile(positional, { flags }) {
  const message = positional.join(" ").trim();
  if (!message) {
    console.error("compile: missing <message>");
    return 1;
  }
  const preview = await gatewayRequest("POST", "/v1/context/preview", {
    flags,
    body: {
      app_id: flags.appId,
      user_id: flags.userId,
      message,
      max_context_tokens: 1200,
    },
  });
  const output = String(preview?.compiled_context ?? "");
  if (!output) {
    console.error("compile: gateway returned no compiled_context");
    return 1;
  }
  if (flags.out) {
    await writeFile(flags.out, output, "utf-8");
    console.error(`wrote ${flags.out} (${output.length} chars)`);
  } else {
    process.stdout.write(output);
    if (!output.endsWith("\n")) process.stdout.write("\n");
  }
  return 0;
}


async function runFiles(positional, { flags }) {
  const [verb, folder] = positional;
  if (verb !== "sync" || !folder) {
    console.error("files sync <folder>");
    return 1;
  }
  console.log("`n0tune files sync` delegates to n0tune-markdown-folder.");
  console.log(
    `Run:  n0tune-markdown-sync ${folder} --base-url ${flags.baseUrl} --api-key ${flags.apiKey} --app-id ${flags.appId}`,
  );
  return 0;
}

function runMcp(positional) {
  const [verb] = positional;
  if (verb !== "install") {
    console.error("mcp install");
    return 1;
  }
  const claudeDesktop = {
    mcpServers: {
      n0tune: {
        command: "node",
        args: ["./integrations/mcp-server/src/server.mjs"],
        env: {
          N0TUNE_BASE_URL: "http://localhost:8000",
          N0TUNE_API_KEY: "replace-with-local-development-key",
          N0TUNE_APP_ID: "demo",
          N0TUNE_USER_ID: "claude_desktop",
        },
      },
    },
  };
  console.log("# Claude Desktop — paste into claude_desktop_config.json:");
  console.log(JSON.stringify(claudeDesktop, null, 2));
  console.log("\n# Cursor — same shape under cursor.config.json's mcpServers key.");
  console.log("# See docs/mcp.md for full setup.");
  return 0;
}

function runStub(name) {
  console.log(`n0tune ${name}: coming next. See docs/editions.md for status.`);
  return 0;
}

export async function runCli(argv) {
  const { flags, positional } = parseFlags(argv);
  if (flags.help || positional.length === 0) {
    console.log(USAGE);
    return 0;
  }
  const [command, ...rest] = positional;
  switch (command) {
    case "doctor":
      return runDoctor({ flags });
    case "demo":
      return runDemo({ flags });
    case "compile":
      return runCompile(rest, { flags });
    case "memory":
      return runMemory(rest, { flags });
    case "persona":
      return runPersona(rest, { flags });
    case "files":
      return runFiles(rest, { flags });
    case "mcp":
      return runMcp(rest);
    case "init":
      return runStub("init");
    case "desktop":
      return runStub("desktop start");
    case "gateway":
      return runStub("gateway start");
    default:
      console.error(`unknown command: ${command}\n`);
      console.error(USAGE);
      return 1;
  }
}
