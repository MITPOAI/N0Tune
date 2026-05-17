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
  let synced = 0;
  let skipped = 0;

  for (const entry of fs.readdirSync(worktreesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const worktreeDir = path.join(worktreesRoot, entry.name);
    const worktreeClaudeDir = path.join(worktreeDir, ".claude");
    const targetPath = path.join(worktreeClaudeDir, "mcp.json");

    if (fs.existsSync(targetPath)) {
      // Respect per-worktree overrides — never clobber.
      skipped += 1;
      continue;
    }

    fs.mkdirSync(worktreeClaudeDir, { recursive: true });
    fs.writeFileSync(targetPath, sourceContent, "utf8");
    synced += 1;
  }

  if (synced > 0) {
    process.stdout.write(
      `n0tune mcp sync: copied .claude/mcp.json into ${synced} worktree(s)` +
        (skipped > 0 ? `, skipped ${skipped} with existing config` : "") +
        "\n",
    );
  }
  // When nothing changed, stay silent so the npm postinstall hook
  // doesn't add noise to every `npm install`.
}

main();
