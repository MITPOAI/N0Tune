# Install N0Tune

N0Tune is a **context-tuning system** — local memory, a persona profile,
indexed files, semantic cache, and a context compiler that gives any
LLM personal context without fine-tuning. Consumable as a standalone
Desktop app or wired into Claude Code / Cursor / Codex CLI via MCP.

It is **not** distributed via the Microsoft Store or Mac App Store. You
download installers from the [GitHub releases page](https://github.com/MITPOAI/N0Tune/releases)
or build them yourself. Binaries are unsigned — see
[Signing & trust](#signing--trust) below.

## What you actually install

| Component         | When you need it                                                                | How to get it                                  |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Desktop**       | Always. This is the tray + hotkey + status overlay + fallback chat.             | Download a Tauri installer or build from src.  |
| **Gateway**       | Only if you want MCP, the OpenAI-compat proxy, or memory sync across devices.   | `docker compose up` from this repo.            |
| **CLI**           | Useful but optional — diagnostics, MCP install helper, `n0tune compile <text>`. | `npm i -g @n0tune/cli` (Node 20+).             |
| **MCP config**    | Only if you wire Claude / Cursor / Codex CLI to your memory.                    | `n0tune mcp install` writes it; or copy JSON.  |

You can run **Desktop alone**. The Gateway is for power users who want
ambient cross-tool integration.

---

## Option A — Download a pre-built installer (recommended for users)

We attach pre-built installers to every GitHub release. Latest:

> https://github.com/MITPOAI/N0Tune/releases/latest

Pick the file that matches your OS:

| OS                | File                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| Windows 10 / 11   | `N0Tune_<version>_x64-setup.exe` (NSIS) or `N0Tune_<version>_x64.msi`  |
| macOS (Apple Si)  | `N0Tune_<version>_aarch64.dmg`                                         |
| macOS (Intel)     | `N0Tune_<version>_x64.dmg`                                             |
| Linux (.deb)      | `n0tune_<version>_amd64.deb`                                           |
| Linux (AppImage)  | `n0tune_<version>_amd64.AppImage`                                      |

Run the installer the same way you'd run any other one.

After install, N0Tune lives in the system tray. Press
`Cmd+Shift+Space` (mac) or `Alt+Space` (Windows/Linux) anywhere to
quick-save a memory.

### macOS one-time step (until we notarize)

Bundles are **not** notarized yet. After install, run once:

```bash
xattr -dr com.apple.quarantine /Applications/N0Tune.app
```

Or right-click N0Tune.app → **Open** → confirm the prompt.

### Windows SmartScreen warning

The installer is **not** signed with an EV certificate yet. SmartScreen
will warn the first time. Click **More info** → **Run anyway**.

### Linux AppImage

```bash
chmod +x n0tune_*.AppImage
./n0tune_*.AppImage
```

---

## Option B — Build from source

For developers, or if you want a release that's not on GitHub yet.

### Prerequisites

- Node 20+, npm.
- Rust toolchain via [rustup](https://rustup.rs/).
- Tauri OS prerequisites — see
  [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/).

### Build

```bash
git clone https://github.com/MITPOAI/N0Tune.git
cd N0Tune
npm install

# One-time: generate platform-specific icon formats from the source PNG.
npm --workspace apps/desktop run tauri:icon

# Build installers for your current OS.
npm --workspace apps/desktop run tauri:build
```

Output paths under `apps/desktop/src-tauri/target/release/bundle/`.

### Dev mode (no installer)

```bash
npm --workspace apps/desktop run tauri:dev
```

This boots the renderer at `localhost:1420` and a Rust webview that
talks to the local SQLite + keychain.

---

## Run the Gateway (optional)

Only needed if you want **MCP**, the **OpenAI-compat proxy**, or
**multi-device sync**. Desktop works without it.

```bash
cp .env.example .env
docker compose up -d --wait
curl -fsS http://localhost:8000/health
```

The API listens on `http://localhost:8000` by default; the dashboard
on `http://localhost:3000`. Configure providers and persona in the
dashboard's **Settings** tab.

---

## Wire it to Claude / Cursor / Codex CLI

The CLI writes the config for you:

```bash
npx @n0tune/cli mcp install
```

Or paste the prompt below into Claude Code / Claude Desktop / Cursor /
Codex CLI to have **the AI itself** set up N0Tune. This is the fastest
path for users who already trust their AI assistant with file edits.

### The exact prompt

```
You are helping me wire up N0Tune as my local AI memory layer via MCP.

Goal: install the N0Tune MCP server so this client can save and search
my memories without me writing config by hand.

Steps:
1. Verify Node 20+ is installed (`node --version`).
2. Verify the N0Tune Gateway is running (`curl -fsS http://localhost:8000/health`).
   If it's not, tell me — don't try to start it; I want to confirm
   before any service boots.
3. Locate this client's MCP config file:
   - Claude Desktop: shown in Claude Desktop → Settings → Developer.
   - Claude Code: `.claude/mcp.json` in the current project (preferred)
     or `~/.claude/mcp.json` globally.
   - Cursor: `~/.cursor/cursor.config.json` (or
     `%USERPROFILE%\.cursor\cursor.config.json` on Windows).
   - Codex CLI: `~/.codex/config.json` (location depends on version;
     `codex config path` prints it).
4. Add an `mcpServers.n0tune` entry pointing at
   `<repo>/integrations/mcp-server/src/server.mjs` with env:
   - N0TUNE_API_BASE_URL=http://localhost:8000
   - N0TUNE_API_KEY=<my-local-dev-key>  (ask me for it)
   - N0TUNE_APP_ID=demo
   - N0TUNE_USER_ID=<a stable id for me>
5. Show me the diff before writing. If `mcpServers` already exists,
   merge, don't overwrite.
6. After I restart the client, confirm the seven n0tune_* tools appear
   in the tools list.

Do not:
- Try to read or move memories until I ask you to.
- Run the MCP server as a network service. It is stdio-only.
- Bypass my Gateway URL — if I'm on a remote Gateway, that's my call.

When done, prove it by asking me one thing you can remember about my
work style, then calling n0tune_save_memory with that fact.
```

Copy that block, paste it into Claude / Cursor / Codex, and follow along.

### What this gets you

After it runs, your AI tool has seven new tools — all `n0tune_*`:

- `n0tune_save_memory`, `n0tune_search_memories`, `n0tune_forget_memory`
- `n0tune_context_preview`, `n0tune_compile_context`
- `n0tune_get_persona`, `n0tune_set_persona`

The full per-tool reference and detailed setup for each client is in
[`docs/wire-to-claude.md`](wire-to-claude.md),
[`docs/wire-to-codex-cli.md`](wire-to-codex-cli.md), and
[`docs/wire-to-gemini-cli.md`](wire-to-gemini-cli.md).

---

## Signing & trust

- **No telemetry.** Zero, by product promise.
- **No auto-update.** You upgrade by re-downloading.
- **Not yet signed.** Windows SmartScreen and macOS Gatekeeper will warn.
  Tracked as a release-pipeline follow-up — see
  [`docs/release-checklist.md`](release-checklist.md).
- **Memory is local.** Desktop writes to SQLite + OS keychain at the
  paths documented in [`docs/desktop-architecture.md`](desktop-architecture.md).

If any of those answers don't match what your machine is actually doing,
that's a bug — open an issue.
