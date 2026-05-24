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

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const USAGE = `n0tune <command> [args]

Commands:
  doctor                       Check Gateway + provider + memory health.
  demo                         Run the two-user personalization demo.
  compile <message>            Print the compiled context for <message> as plain text
                               (used by the Gemini CLI adapter; works with any tool that
                               accepts a system prompt from stdin/file).

  project detect                Detect/register the current project folder.
  project init                  Write .n0tune/project.json and ignore local config.
  project status                Show project context summary.

  session start --tool <name>   Start a tracked AI-tool session for this project.
  session summarize             Update a session summary with --session-id.
  session list                  List sessions for this project.

  handoff create --source <tool>
                               Create a Handoff Capsule for this project.
  handoff latest                Print the latest Handoff Capsule.
  handoff continue              Print a continuation prompt from the latest capsule.

  memory list                  List memories for a user.
  memory add <text>            Save a memory for a user.
  memory add --project <text>  Save a project-scoped memory for this folder.
  memory search --project <q>  Search project-scoped memory for this folder.
  memory delete <id>           Soft-delete a memory.
  memory export                Dump memories to JSON.
  memory consolidate           Cluster + collapse similar memories. Use --dry-run
                               to preview without writing.

  persona export [--out file]  Export the current persona shell (no private memories).
  persona import <ref>         Apply a .n0tune persona to --user-id.
                               <ref> can be:
                                 ./local/path.n0tune.json
                                 senior-staff-eng                  (community repo)
                                 gh:owner/repo/path/to.n0tune.json (any GitHub repo)
                               Patches the style profile and creates starter memories
                               (skips duplicates by exact text match).

  files sync <folder>          Walk Markdown files and POST them to the Gateway.
  context preview --project <q>
                               Preview project context without calling a model.

  mcp install                  Print Claude Desktop / Cursor MCP config snippets.
  mcp sync                     Copy <repo>/.claude/mcp.json into every git worktree
                               under .claude/worktrees/* so Claude Code finds it
                               regardless of which working tree you open.

  init                         (stub) Create a local config.
  desktop start                (stub) Boot the Desktop dev server.
  gateway start                (stub) Boot the Gateway via Docker Compose.

Global options:
  --base-url <url>             Gateway base URL. Default http://localhost:8000.
  --api-key <key>              Gateway API key. Default $N0TUNE_API_KEY.
  --app-id <id>                Gateway app id.   Default 'demo'.
  --user-id <id>               User id where applicable. Default 'cli'.
  --cwd <path>                 Project folder. Default current working directory.
  --tool <name>                Tool name for project/session commands.
  --source <tool>              Source tool for handoff create.
  --target <tool>              Target tool for handoff continue.
  --title <text>               Title for sessions or handoffs.
  --goal <text>                Goal for sessions or handoffs.
  --model <name>               Optional model name for session tracking.
  --session-id <id>            Session id for summarize/handoff linkage.
  --type <type>                Memory type for memory add.
  --out <file>                 Write output to a file instead of stdout.
  --dry-run                    Preview the action without writing (memory consolidate).
  --project                    Use the current project scope where supported.
  --copy                       Copy continuation prompt to clipboard when supported.
  -h, --help                   Show this help.
`;

function parseFlags(args) {
  const flags = {
    baseUrl: process.env.N0TUNE_BASE_URL ?? "http://localhost:8000",
    apiKey: process.env.N0TUNE_API_KEY ?? "replace-with-local-development-key",
    appId: process.env.N0TUNE_APP_ID ?? "demo",
    userId: process.env.N0TUNE_USER_ID ?? "cli",
    cwd: process.cwd(),
    toolName: null,
    sourceTool: null,
    targetTool: null,
    title: null,
    goal: null,
    model: null,
    sessionId: null,
    type: null,
    out: null,
    dryRun: false,
    project: false,
    copy: false,
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
      case "--cwd":
        flags.cwd = args[++i];
        break;
      case "--tool":
        flags.toolName = args[++i];
        break;
      case "--source":
        flags.sourceTool = args[++i];
        break;
      case "--target":
        flags.targetTool = args[++i];
        break;
      case "--title":
        flags.title = args[++i];
        break;
      case "--goal":
        flags.goal = args[++i];
        break;
      case "--model":
        flags.model = args[++i];
        break;
      case "--session-id":
        flags.sessionId = args[++i];
        break;
      case "--type":
        flags.type = args[++i];
        break;
      case "--out":
        flags.out = args[++i];
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--project":
        flags.project = true;
        break;
      case "--copy":
        flags.copy = true;
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

async function detectCurrentProject(flags, toolName = flags.toolName ?? "cli") {
  return await gatewayRequest("POST", "/v1/projects/detect", {
    flags,
    body: {
      app_id: flags.appId,
      cwd: flags.cwd,
      tool_name: toolName,
    },
  });
}

function encodeQuery(params) {
  return new URLSearchParams(params).toString();
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function parseListText(value) {
  return String(value ?? "")
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function copyToClipboard(text) {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      execFileSync("clip.exe", [], { input: text });
      return true;
    }
    if (platform === "darwin") {
      execFileSync("pbcopy", [], { input: text });
      return true;
    }
    try {
      execFileSync("wl-copy", [], { input: text });
      return true;
    } catch {
      execFileSync("xclip", ["-selection", "clipboard"], { input: text });
      return true;
    }
  } catch {
    return false;
  }
}

async function detectLocalProject(flags) {
  let root;
  try {
    root = execFileSync("git", ["-C", flags.cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    root = findMarkerRoot(resolve(flags.cwd));
  }
  const name = await localProjectName(root);
  const rootHash = createHash("sha256")
    .update(resolve(root).replaceAll("\\", "/").toLowerCase())
    .digest("hex");
  return {
    project_id: `proj_${rootHash.slice(0, 24)}`,
    project_name: name,
    detected_root: root,
    status: "local-only",
    fingerprint: {
      root_path_hash: rootHash,
      workspace_name: name,
      has_project_config: existsSync(join(root, ".n0tune", "project.json")),
    },
  };
}

function findMarkerRoot(start) {
  const markers = [".n0tune", ".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];
  let current = resolve(start);
  while (true) {
    if (markers.some((marker) => existsSync(join(current, marker)))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

async function localProjectName(root) {
  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    try {
      const parsed = JSON.parse(await readFile(packagePath, "utf-8"));
      if (parsed?.name) return String(parsed.name);
    } catch {
      // Fall through to folder name.
    }
  }
  return root.split(/[\\/]/).filter(Boolean).at(-1) ?? "project";
}

/**
 * Resolve a persona reference into the file's text content.
 *
 * Accepts three forms:
 *   - `./local/path.n0tune.json`  → readFile
 *   - `gh:owner/repo/path/to.json` → https raw.githubusercontent.com
 *   - bare name like `senior-staff-eng` → resolve against
 *       `N0TUNE_PERSONAS_URL` (default points at the public
 *       community repo). The `.n0tune.json` suffix is added if absent.
 *
 * Anything starting with `./`, `/`, or a drive letter is treated as
 * a local path. `http://` and `https://` URLs are fetched verbatim.
 */
async function fetchPersonaContent(ref) {
  // gh:owner/repo/path
  if (ref.startsWith("gh:")) {
    const after = ref.slice(3);
    const [owner, repo, ...rest] = after.split("/");
    if (!owner || !repo || rest.length === 0) {
      throw new Error(`malformed gh: ref. expected gh:owner/repo/path, got ${ref}`);
    }
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${rest.join("/")}`;
    return await httpsFetchText(url);
  }
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return await httpsFetchText(ref);
  }
  // Local path heuristics: ./, ../, /, or Windows drive letter, or .json suffix
  const looksLocal =
    ref.startsWith("./") ||
    ref.startsWith("../") ||
    ref.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(ref) ||
    ref.endsWith(".json");
  if (looksLocal) {
    return await readFile(resolve(ref), "utf-8");
  }
  // Bare name → community repo
  const base =
    process.env.N0TUNE_PERSONAS_URL ??
    "https://raw.githubusercontent.com/MITPOAI/N0Tune/main/personas/";
  const name = ref.endsWith(".n0tune.json") ? ref : `${ref}.n0tune.json`;
  return await httpsFetchText(base.replace(/\/$/, "") + "/" + name);
}

async function httpsFetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} → HTTP ${res.status}`);
  }
  return await res.text();
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

async function runProject(positional, { flags }) {
  const [verb] = positional;
  switch (verb) {
    case "detect": {
      const project = await detectCurrentProject(flags, flags.toolName ?? "cli");
      printJson(project);
      return 0;
    }
    case "init": {
      let project;
      try {
        project = await detectCurrentProject(flags, flags.toolName ?? "cli");
      } catch (error) {
        console.error(`project init: gateway unavailable, writing local-only config (${error.message})`);
        project = await detectLocalProject(flags);
      }
      const root = project.detected_root;
      const n0tuneDir = join(root, ".n0tune");
      await mkdir(n0tuneDir, { recursive: true });
      const config = {
        project_id: project.project_id,
        name: project.project_name,
        root: ".",
        created_at: new Date().toISOString(),
        mode: project.status === "local-only" ? "local" : "gateway",
        memory_policy: "review",
        tools: {
          claude: true,
          codex: true,
          cursor: true,
        },
      };
      await writeFile(join(n0tuneDir, "project.json"), JSON.stringify(config, null, 2) + "\n", "utf-8");
      await writeFile(
        join(n0tuneDir, "project.example.json"),
        JSON.stringify({ ...config, project_id: "proj_example" }, null, 2) + "\n",
        "utf-8",
      );
      await ensureN0TuneIgnored(root);
      printJson({ ok: true, path: join(n0tuneDir, "project.json"), project });
      return 0;
    }
    case "status": {
      const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
      const context = await gatewayRequest(
        "GET",
        `/v1/projects/${encodeURIComponent(detected.project_id)}/context?${encodeQuery({
          app_id: flags.appId,
        })}`,
        { flags },
      );
      printJson({ detected, context });
      return 0;
    }
    default:
      console.error("project detect | project init | project status");
      return 1;
  }
}

async function ensureN0TuneIgnored(root) {
  const gitignore = join(root, ".gitignore");
  let existing = "";
  try {
    existing = await readFile(gitignore, "utf-8");
  } catch {
    existing = "";
  }
  if (existing.includes(".n0tune/") || existing.includes(".n0tune/*")) return;
  const block = [
    "",
    "# N0Tune local project context",
    ".n0tune/*",
    "!.n0tune/",
    "!.n0tune/project.example.json",
    "",
  ].join("\n");
  await writeFile(gitignore, existing.replace(/\s*$/, "\n") + block, "utf-8");
}

async function runSession(positional, { flags }) {
  const [verb, ...rest] = positional;
  switch (verb) {
    case "start": {
      const toolName = flags.toolName;
      if (!toolName) {
        console.error("session start: missing --tool <name>");
        return 1;
      }
      const detected = await detectCurrentProject(flags, toolName);
      const goal = (flags.goal ?? rest.join(" ").trim()) || null;
      const created = await gatewayRequest(
        "POST",
        `/v1/projects/${encodeURIComponent(detected.project_id)}/sessions`,
        {
          flags,
          body: {
            app_id: flags.appId,
            tool_name: toolName,
            title: flags.title,
            goal,
            model: flags.model,
          },
        },
      );
      printJson(created);
      return 0;
    }
    case "summarize": {
      if (!flags.sessionId) {
        console.error("session summarize: missing --session-id <id>");
        return 1;
      }
      const summary = rest.join(" ").trim();
      if (!summary) {
        console.error("session summarize: missing summary text");
        return 1;
      }
      const updated = await gatewayRequest(
        "PATCH",
        `/v1/sessions/${encodeURIComponent(flags.sessionId)}`,
        {
          flags,
          body: {
            app_id: flags.appId,
            status: "summarized",
            summary,
            next_steps: parseListText(flags.goal),
          },
        },
      );
      printJson(updated);
      return 0;
    }
    case "list": {
      const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
      const sessions = await gatewayRequest(
        "GET",
        `/v1/projects/${encodeURIComponent(detected.project_id)}/sessions?${encodeQuery({
          app_id: flags.appId,
        })}`,
        { flags },
      );
      printJson(sessions);
      return 0;
    }
    default:
      console.error("session start --tool <name> | session summarize --session-id <id> | session list");
      return 1;
  }
}

async function runHandoff(positional, { flags }) {
  const [verb, ...rest] = positional;
  switch (verb) {
    case "create": {
      const sourceTool = flags.sourceTool ?? flags.toolName;
      if (!sourceTool) {
        console.error("handoff create: missing --source <tool>");
        return 1;
      }
      const detected = await detectCurrentProject(flags, sourceTool);
      const currentState = rest.join(" ").trim();
      if (!currentState) {
        console.error("handoff create: missing current-state text");
        return 1;
      }
      const created = await gatewayRequest(
        "POST",
        `/v1/projects/${encodeURIComponent(detected.project_id)}/handoffs`,
        {
          flags,
          body: {
            app_id: flags.appId,
            source_tool: sourceTool,
            target_tool: flags.targetTool,
            session_id: flags.sessionId,
            title: flags.title,
            goal: flags.goal,
            current_state: currentState,
            next_steps: parseListText(flags.goal),
          },
        },
      );
      printJson(created);
      return 0;
    }
    case "latest": {
      const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
      const latest = await latestHandoff(flags, detected.project_id);
      if (!latest) {
        console.log("No Handoff Capsule found for this project.");
        return 0;
      }
      if (flags.copy) {
        return await printContinuationPrompt(flags, latest.id);
      }
      printJson(latest);
      return 0;
    }
    case "continue": {
      const handoffId = rest[0]?.startsWith("hof_") ? rest[0] : null;
      if (handoffId) {
        return await printContinuationPrompt(flags, handoffId);
      }
      const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
      const latest = await latestHandoff(flags, detected.project_id);
      if (!latest) {
        console.error("handoff continue: no Handoff Capsule found for this project");
        return 1;
      }
      return await printContinuationPrompt(flags, latest.id);
    }
    default:
      console.error("handoff create --source <tool> | handoff latest | handoff continue");
      return 1;
  }
}

async function latestHandoff(flags, projectId) {
  const handoffs = await gatewayRequest(
    "GET",
    `/v1/projects/${encodeURIComponent(projectId)}/handoffs?${encodeQuery({
      app_id: flags.appId,
      limit: "1",
    })}`,
    { flags },
  );
  return Array.isArray(handoffs) && handoffs.length ? handoffs[0] : null;
}

async function printContinuationPrompt(flags, handoffId) {
  const continued = await gatewayRequest(
    "POST",
    `/v1/handoffs/${encodeURIComponent(handoffId)}/continue-prompt`,
    {
      flags,
      body: { app_id: flags.appId, target_tool: flags.targetTool },
    },
  );
  const prompt = String(continued.continuation_prompt ?? "");
  if (flags.copy) {
    const copied = await copyToClipboard(prompt);
    console.error(copied ? "copied continuation prompt to clipboard" : "clipboard copy failed");
  }
  process.stdout.write(prompt);
  if (!prompt.endsWith("\n")) process.stdout.write("\n");
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
      if (flags.project) {
        const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
        const created = await gatewayRequest(
          "POST",
          `/v1/projects/${encodeURIComponent(detected.project_id)}/memories`,
          {
            flags,
            body: {
              app_id: flags.appId,
              user_id: flags.userId,
              type: flags.type ?? "project",
              text,
              confidence: 0.85,
            },
          },
        );
        printJson(created);
        return 0;
      }
      const created = await gatewayRequest("POST", "/v1/memories", {
        flags,
        body: {
          app_id: flags.appId,
          user_id: flags.userId,
          type: flags.type ?? "fact",
          text,
          confidence: 0.85,
        },
      });
      console.log(JSON.stringify(created, null, 2));
      return 0;
    }
    case "search": {
      const query = rest.join(" ").trim();
      if (!query) {
        console.error("memory search: missing query");
        return 1;
      }
      if (flags.project) {
        const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
        const memories = await gatewayRequest(
          "GET",
          `/v1/projects/${encodeURIComponent(detected.project_id)}/memories?${encodeQuery({
            app_id: flags.appId,
            q: query,
          })}`,
          { flags },
        );
        printJson(memories);
        return 0;
      }
      const memories = await gatewayRequest(
        "GET",
        `/v1/memories?${encodeQuery({
          app_id: flags.appId,
          user_id: flags.userId,
          q: query,
        })}`,
        { flags },
      );
      printJson(memories);
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
    case "consolidate": {
      const params = new URLSearchParams({
        app_id: flags.appId,
        user_id: flags.userId,
        dry_run: flags.dryRun ? "true" : "false",
      });
      const report = await gatewayRequest(
        "POST",
        `/v1/memories/consolidate?${params.toString()}`,
        { flags },
      );
      console.log(JSON.stringify(report, null, 2));
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
      const ref = rest[0];
      if (!ref) {
        console.error(
          "persona import: missing <file-or-name>\n" +
            "  examples:\n" +
            "    n0tune persona import ./personas/senior-staff-eng.n0tune.json\n" +
            "    n0tune persona import senior-staff-eng\n" +
            "    n0tune persona import gh:MITPOAI/N0Tune/personas/marketing-lead.n0tune.json",
        );
        return 1;
      }

      let content;
      try {
        content = await fetchPersonaContent(ref);
      } catch (error) {
        console.error(`persona import: ${error.message}`);
        return 1;
      }

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

      const style = parsed.persona?.style;
      if (!style || typeof style !== "object") {
        console.error("persona import: persona.style is required");
        return 1;
      }

      // Apply style profile
      const styleResult = await gatewayRequest(
        "PATCH",
        `/v1/users/${encodeURIComponent(flags.userId)}/style`,
        {
          flags,
          body: { app_id: flags.appId, profile_json: style },
        },
      );

      // Apply starter memories (dedupe by exact text)
      const incoming = Array.isArray(parsed.memories) ? parsed.memories : [];
      let existing = [];
      if (incoming.length) {
        existing = await gatewayRequest(
          "GET",
          `/v1/memories?app_id=${encodeURIComponent(flags.appId)}&user_id=${encodeURIComponent(flags.userId)}&limit=200`,
          { flags },
        );
      }
      const existingTexts = new Set(existing.map((m) => m.text));

      let created = 0;
      let skipped = 0;
      for (const mem of incoming) {
        if (!mem?.text || existingTexts.has(mem.text)) {
          skipped += 1;
          continue;
        }
        await gatewayRequest("POST", "/v1/memories", {
          flags,
          body: {
            app_id: flags.appId,
            user_id: flags.userId,
            type: mem.type ?? "preference",
            text: mem.text,
            confidence: typeof mem.confidence === "number" ? mem.confidence : 0.8,
          },
        });
        created += 1;
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            persona: { name: parsed.persona?.name, version: parsed.version },
            applied: {
              user_id: flags.userId,
              app_id: flags.appId,
              style_fields: Object.keys(style),
              memories_created: created,
              memories_skipped_as_duplicate: skipped,
              style_updated_at: styleResult?.updated_at,
            },
          },
          null,
          2,
        ),
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

async function runContext(positional, { flags }) {
  const [verb, ...rest] = positional;
  if (verb !== "preview") {
    console.error("context preview --project <query>");
    return 1;
  }
  const query = rest.join(" ").trim();
  if (!query) {
    console.error("context preview: missing query");
    return 1;
  }
  if (!flags.project) {
    console.error("context preview currently requires --project. Use `n0tune compile` for user context.");
    return 1;
  }
  const detected = await detectCurrentProject(flags, flags.toolName ?? "cli");
  const context = await gatewayRequest(
    "GET",
    `/v1/projects/${encodeURIComponent(detected.project_id)}/context?${encodeQuery({
      app_id: flags.appId,
      query,
    })}`,
    { flags },
  );
  printJson(context);
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
  if (verb === "sync") {
    return runMcpSync();
  }
  if (verb !== "install") {
    console.error("mcp install | mcp sync");
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

function runMcpSync() {
  // Resolve repo root via git first (handles worktrees and submodules);
  // fall back to the CLI's own location (packages/cli/src/ → repo root).
  let repoRoot;
  try {
    repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  }
  const script = resolve(repoRoot, "scripts", "sync-mcp-config.mjs");
  try {
    execFileSync("node", [script], { stdio: "inherit" });
    return 0;
  } catch (error) {
    console.error(`mcp sync failed: ${error?.message ?? error}`);
    return 1;
  }
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
    case "project":
      return runProject(rest, { flags });
    case "session":
      return runSession(rest, { flags });
    case "handoff":
      return runHandoff(rest, { flags });
    case "memory":
      return runMemory(rest, { flags });
    case "persona":
      return runPersona(rest, { flags });
    case "context":
      return runContext(rest, { flags });
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
