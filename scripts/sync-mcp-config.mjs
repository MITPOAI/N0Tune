#!/usr/bin/env node
/**
 * Ensure Claude Code finds the canonical N0Tune MCP config no matter
 * which directory it was launched from.
 *
 * Why this script exists
 * ----------------------
 * Claude Code 2.x discovers MCP servers from one of three places, in
 * priority order:
 *
 *   1. Project scope:  `<repo-root>/.mcp.json`         (committed to git;
 *                                                       shared with all
 *                                                       collaborators)
 *   2. Local scope:    `~/.claude.json` -> projects[<cwd>].mcpServers
 *                                                      (managed by the
 *                                                       `claude mcp add`
 *                                                       CLI)
 *   3. User scope:     `~/.claude.json` -> mcpServers  (every project)
 *
 * The canonical N0Tune config lives at the repo-root `.mcp.json`
 * (project scope, committed). This sync script keeps two derived
 * surfaces aligned with it so the user's first `claude` invocation
 * just works:
 *
 *   - It copies `.mcp.json` into each Claude-Code-managed worktree
 *     under `.claude/worktrees/<name>/.mcp.json` so a fresh session
 *     from a worktree directory finds the same config.
 *   - In each worktree copy, any relative path in `args` that doesn't
 *     resolve inside the worktree (these are sparse subtrees that
 *     omit `integrations/` and `apps/`) gets rewritten to an absolute
 *     path under the canonical repo root.
 *   - It also removes stale `.claude/mcp.json` files left behind by
 *     earlier (Claude Code 1.x style) syncs — those aren't read by
 *     Claude Code 2.x and only cause confusion.
 *
 * The script is idempotent, no-deps, and silent when there's nothing
 * to do — safe to call from the root `npm install` postinstall hook.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILE = ".mcp.json";
const LEGACY_FILE = path.join(".claude", "mcp.json"); // Claude Code 1.x

function resolveRepoRoot() {
  // 1. Prefer `git rev-parse --show-toplevel` — works inside a clone,
  //    a worktree, even a submodule.
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const root = out.trim();
    if (root && fs.existsSync(root)) return root;
  } catch {
    // ignore
  }
  // 2. Fallback: this script lives at <root>/scripts/sync-mcp-config.mjs.
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/**
 * Rewrite any relative `args` path that doesn't resolve from the
 * target worktree into an absolute path under the canonical repo
 * root. Claude-Code-managed worktrees under `.claude/worktrees/` are
 * a sparse copy that omits `integrations/` and `apps/`, so the
 * canonical `./integrations/mcp-server/src/server.mjs` arg would
 * fail to load from a worktree CWD.
 */
function rewriteArgsForWorktree(config, repoRoot, worktreeDir) {
  if (!config?.mcpServers || typeof config.mcpServers !== "object") {
    return config;
  }
  const rewritten = { ...config, mcpServers: { ...config.mcpServers } };
  for (const [name, server] of Object.entries(rewritten.mcpServers)) {
    if (!Array.isArray(server?.args)) continue;
    const newArgs = server.args.map((arg) => {
      if (typeof arg !== "string") return arg;
      if (!arg.startsWith("./") && !arg.startsWith("../")) return arg;
      const worktreeResolved = path.resolve(worktreeDir, arg);
      if (fs.existsSync(worktreeResolved)) {
        return arg;
      }
      const rootResolved = path.resolve(repoRoot, arg);
      if (fs.existsSync(rootResolved)) {
        return rootResolved;
      }
      return arg;
    });
    rewritten.mcpServers[name] = { ...server, args: newArgs };
  }
  return rewritten;
}

function tryRemoveLegacy(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const root = resolveRepoRoot();
  const sourcePath = path.join(root, SOURCE_FILE);

  // Also nuke the root-level legacy file if it's there — it's never read by
  // Claude Code 2.x and we don't want two competing sources of truth.
  const legacyRootRemoved = tryRemoveLegacy(path.join(root, LEGACY_FILE));

  if (!fs.existsSync(sourcePath)) {
    // No canonical config yet. Quietly do nothing — keeping the
    // postinstall hook noise-free.
    return;
  }

  const sourceContent = fs.readFileSync(sourcePath, "utf8");
  let sourceConfig;
  try {
    sourceConfig = JSON.parse(sourceContent);
  } catch (err) {
    process.stderr.write(
      `n0tune mcp sync: failed to parse ${sourcePath}: ${
        err?.message ?? err
      }\n`,
    );
    process.exitCode = 1;
    return;
  }

  const worktreesRoot = path.join(root, ".claude", "worktrees");
  if (!fs.existsSync(worktreesRoot)) {
    if (legacyRootRemoved) {
      process.stdout.write(
        `n0tune mcp sync: removed stale ${LEGACY_FILE} (Claude Code 2.x reads .mcp.json instead)\n`,
      );
    }
    return;
  }

  let synced = 0;
  let updated = 0;
  let legacyRemoved = 0;
  let rewroteAnyPaths = false;

  for (const entry of fs.readdirSync(worktreesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const worktreeDir = path.join(worktreesRoot, entry.name);
    const targetPath = path.join(worktreeDir, SOURCE_FILE);

    // Always remove the worktree's legacy `.claude/mcp.json` file if it
    // exists — Claude Code 2.x doesn't read it and we don't want it to
    // mask the real config.
    if (tryRemoveLegacy(path.join(worktreeDir, LEGACY_FILE))) {
      legacyRemoved += 1;
    }

    const adjustedConfig = rewriteArgsForWorktree(
      sourceConfig,
      root,
      worktreeDir,
    );
    const adjustedJson = JSON.stringify(adjustedConfig, null, 2) + "\n";

    if (adjustedJson !== sourceContent) {
      rewroteAnyPaths = true;
    }

    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, "utf8");
      if (existing.trim() === adjustedJson.trim()) {
        continue; // no change needed
      }
      // The canonical config has changed since last sync — update
      // the worktree to match. Never clobber a worktree that has its
      // OWN n0tune entry with a different shape, but DO refresh if
      // it's just stale-from-an-older-sync.
      try {
        const existingParsed = JSON.parse(existing);
        const existingN0Tune = existingParsed?.mcpServers?.n0tune;
        const newN0Tune = adjustedConfig?.mcpServers?.n0tune;
        if (
          existingN0Tune &&
          newN0Tune &&
          JSON.stringify(existingN0Tune.env ?? {}) !==
            JSON.stringify(newN0Tune.env ?? {}) &&
          existingN0Tune.env?.N0TUNE_USER_ID !==
            newN0Tune.env?.N0TUNE_USER_ID
        ) {
          // The worktree set its own user_id — preserve it.
          continue;
        }
      } catch {
        // Malformed existing file — overwrite.
      }
      fs.writeFileSync(targetPath, adjustedJson, "utf8");
      updated += 1;
      continue;
    }

    fs.writeFileSync(targetPath, adjustedJson, "utf8");
    synced += 1;
  }

  if (synced + updated + legacyRemoved > 0 || legacyRootRemoved) {
    const bits = [];
    if (synced > 0) bits.push(`created ${synced}`);
    if (updated > 0) bits.push(`updated ${updated}`);
    if (legacyRemoved > 0)
      bits.push(`removed ${legacyRemoved} stale .claude/mcp.json`);
    if (legacyRootRemoved)
      bits.push(`removed root .claude/mcp.json`);
    const suffix = rewroteAnyPaths
      ? " (relative args rewritten absolute for sparse worktrees)"
      : "";
    process.stdout.write(
      `n0tune mcp sync: ${bits.join(", ")}${suffix}\n`,
    );
  }
}

main();
