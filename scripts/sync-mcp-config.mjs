#!/usr/bin/env node
/**
 * Copy <repo-root>/.claude/mcp.json into every git worktree under
 * <repo-root>/.claude/worktrees/* so Claude Code can find it regardless
 * of which working tree you open.
 *
 * Why this exists
 * ---------------
 * Claude Code reads `.claude/mcp.json` at session START. It does NOT
 * walk up the directory tree to find a parent repo's config. If you
 * open Claude Code with CWD inside a worktree subfolder and that
 * worktree has no `.claude/mcp.json`, the N0Tune MCP server is not
 * loaded for that session and the `n0tune_*` tools never appear.
 *
 * This script makes "set up MCP once, get it in every worktree"
 * actually true. It is:
 *
 * - **Idempotent.** If a worktree already has its own `.claude/mcp.json`,
 *   we skip it — so per-worktree edits never get clobbered.
 * - **Safe by default.** Only copies INTO `<root>/.claude/worktrees/(name)/`
 *   that already exist. Doesn't create worktrees.
 * - **No deps.** Plain Node, fs + path + child_process only.
 *
 * Run automatically from the root `npm install` postinstall hook, or
 * manually via `n0tune mcp sync`.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
 * Rewrite any relative path in `args` to an absolute path under the
 * repo root, but only if (a) the path looks like a project-relative
 * reference (starts with `./` or `../`) and (b) the target file does
 * not exist at the same relative location from the worktree.
 *
 * Why: Claude-Code-managed "worktrees" under `.claude/worktrees/` are
 * a sparse copy of the project. They contain a subset of the repo
 * (`packages/`, `scripts/`, root files) but typically NOT
 * `integrations/` or `apps/`. So the relative path that works from
 * the repo root (`./integrations/mcp-server/src/server.mjs`) is
 * broken from a worktree's perspective and Claude Code's MCP launch
 * fails immediately. Rewriting to an absolute path under the repo
 * root fixes it without changing the canonical config.
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
        // The worktree happens to have the file at the same relative
        // path. Leave the relative form alone.
        return arg;
      }
      const rootResolved = path.resolve(repoRoot, arg);
      if (fs.existsSync(rootResolved)) {
        return rootResolved;
      }
      // Last resort: leave the original. Better to fail loudly with
      // a clear "file not found" than silently rewrite to nothing.
      return arg;
    });
    rewritten.mcpServers[name] = { ...server, args: newArgs };
  }
  return rewritten;
}

function main() {
  const root = resolveRepoRoot();
  const sourcePath = path.join(root, ".claude", "mcp.json");

  if (!fs.existsSync(sourcePath)) {
    // No canonical config to sync. Not an error — the user simply
    // hasn't wired N0Tune to Claude Code yet. Stay quiet so an
    // unrelated `npm install` doesn't spam logs.
    return;
  }

  const worktreesRoot = path.join(root, ".claude", "worktrees");
  if (!fs.existsSync(worktreesRoot)) {
    // No worktrees to sync into. Done.
    return;
  }

  const sourceContent = fs.readFileSync(sourcePath, "utf8");
  let sourceConfig;
  try {
    sourceConfig = JSON.parse(sourceContent);
  } catch (err) {
    // The canonical config is malformed; don't propagate that into
    // every worktree. Fail loudly so the user knows.
    process.stderr.write(
      `n0tune mcp sync: failed to parse ${sourcePath}: ${err?.message ?? err}\n`,
    );
    process.exitCode = 1;
    return;
  }

  let synced = 0;
  let skipped = 0;
  let rewroteAnyPaths = false;

  for (const entry of fs.readdirSync(worktreesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const worktreeDir = path.join(worktreesRoot, entry.name);
    const worktreeClaudeDir = path.join(worktreeDir, ".claude");
    const targetPath = path.join(worktreeClaudeDir, "mcp.json");

    const adjustedConfig = rewriteArgsForWorktree(
      sourceConfig,
      root,
      worktreeDir,
    );
    const adjustedJson = JSON.stringify(adjustedConfig, null, 2) + "\n";

    if (fs.existsSync(targetPath)) {
      // Already present. If it matches what the sync would produce,
      // skip silently. If it differs (manual edit OR stale sync from
      // a previous version of this script), respect the user's copy
      // and skip — never clobber.
      const existing = fs.readFileSync(targetPath, "utf8");
      if (existing.trim() === adjustedJson.trim()) {
        // Identical, no work to do.
      } else {
        skipped += 1;
      }
      continue;
    }

    fs.mkdirSync(worktreeClaudeDir, { recursive: true });
    fs.writeFileSync(targetPath, adjustedJson, "utf8");
    synced += 1;
    if (adjustedJson !== sourceContent) {
      rewroteAnyPaths = true;
    }
  }

  if (synced > 0) {
    const suffix = rewroteAnyPaths
      ? " (rewrote relative args to absolute paths for sparse worktrees)"
      : "";
    process.stdout.write(
      `n0tune mcp sync: copied .claude/mcp.json into ${synced} worktree(s)` +
        (skipped > 0 ? `, skipped ${skipped} with existing config` : "") +
        `${suffix}\n`,
    );
  }
  // When nothing changed, stay silent so the npm postinstall hook
  // doesn't add noise to every `npm install`.
}

main();
