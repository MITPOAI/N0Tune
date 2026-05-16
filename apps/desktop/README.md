# N0Tune Desktop

The personal AI runtime for your laptop. Bring any model provider; N0Tune adds
local memory, style, files, and a context compiler around it.

> Logo + favicon are sourced from [`../../img/logo-s.png`](../../img/logo-s.png).
> The wordmark `logo.png` is used in the dashboard header and on the README.

## How does it work today?

```
┌────────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  React renderer    │──IPC──│  Tauri (Rust)    │──HTTP─│  Model provider  │
│  (apps/desktop/src)│       │  (src-tauri/)    │       │  (OpenAI/Claude/ │
└────────────────────┘       └────────┬─────────┘       │  Gemini/Ollama…) │
                                      │                 └──────────────────┘
                            ┌─────────▼──────────┐
                            │  Local SQLite +    │
                            │  OS keychain       │
                            │  (storage stub)    │
                            └────────────────────┘
```

Today, the React renderer is **complete** and uses a `LocalStubBackend`
(in-memory). The Tauri Rust side is **scaffolded** (`src-tauri/`) with one
working `runtime_info` command; the SQLite + keychain wiring is the
follow-up work that turns the dev shell into a real downloadable app.

## Run it now (no installer needed)

```bash
# Web preview against the in-memory stub backend — works on any machine
# with Node 20+:
npm --workspace apps/desktop run dev
# Open http://localhost:1420
```

The dev shell exercises every UI surface: onboarding → provider settings →
chat → memory viewer → context preview → persona settings. Memories live
in RAM and reset when you reload.

## Build a downloadable installer

You build the `.exe` / `.dmg` / `.AppImage` from source. We don't host
signed binaries yet (that lands in Phase J of the roadmap).

### One-time prerequisites

- **Node 20+** and **npm**.
- **Rust** via [rustup](https://rustup.rs/).
- **OS-specific build tools** for Tauri 2 — follow
  [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/):
  - **Windows**: Microsoft C++ Build Tools + WebView2 runtime.
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: `webkit2gtk-4.1`, `librsvg2-dev`, `libayatana-appindicator3-dev`,
    `build-essential`, `curl`, `wget`, `file`, `libssl-dev`.

### Generate platform icons (once)

The repo ships PNG icons generated from `img/logo-s.png`. macOS and Windows
also need `.icns` and `.ico`. Tauri's CLI can generate them from the
source PNG:

```bash
npm --workspace apps/desktop run tauri:icon
```

That command writes `src-tauri/icons/icon.icns`, `src-tauri/icons/icon.ico`,
and the Microsoft Store sizes alongside the PNGs we already commit.

### Dev mode (hot-reload)

```bash
npm --workspace apps/desktop run tauri:dev
```

This runs Vite for the renderer and launches a native window through
Tauri. The renderer detects Tauri at runtime (see
`src/tauri-bridge.ts`) and calls real Rust commands instead of the
in-memory stub.

### Production build → installer

```bash
npm --workspace apps/desktop run tauri:build
```

Output paths (relative to the repo):

| OS       | File                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Windows  | `apps/desktop/src-tauri/target/release/bundle/msi/N0Tune_0.1.0_x64_en-US.msi`          |
| Windows  | `apps/desktop/src-tauri/target/release/bundle/nsis/N0Tune_0.1.0_x64-setup.exe`         |
| macOS    | `apps/desktop/src-tauri/target/release/bundle/macos/N0Tune.app`                        |
| macOS    | `apps/desktop/src-tauri/target/release/bundle/dmg/N0Tune_0.1.0_aarch64.dmg`            |
| Linux    | `apps/desktop/src-tauri/target/release/bundle/appimage/n0tune_0.1.0_amd64.AppImage`    |
| Linux    | `apps/desktop/src-tauri/target/release/bundle/deb/n0tune_0.1.0_amd64.deb`              |

The Windows MSI is the typical installer; macOS users want the `.dmg`;
Linux users pick `AppImage` (portable) or `.deb` (installs to `/usr/bin`).

You can sign and notarize macOS bundles by setting Apple Developer
environment variables — see Tauri's [code-signing
guide](https://v2.tauri.app/distribute/sign/macos/). We don't ship any
keys in the repo.

## Bring your own model

Open **Provider** in the desktop window and pick one:

- **OpenAI** — `https://api.openai.com/v1`, model `gpt-4o-mini` (paste your key).
- **Anthropic Claude** — `https://api.anthropic.com`, model `claude-sonnet-4-5`.
- **Google Gemini** — `https://generativelanguage.googleapis.com/v1beta`, model `gemini-1.5-pro`.
- **OpenRouter** — `https://openrouter.ai/api/v1`, any model id (e.g. `openrouter/auto`).
- **Ollama** — `http://localhost:11434/v1`, model `llama3.1:8b-instruct` (no key).
- **LM Studio** — `http://localhost:1234/v1`, the model id from the LM Studio UI.
- **Custom OpenAI-compatible** — paste any URL/model.

API keys are read from the renderer in dev mode (and never persisted to
disk by the stub). When the SQLite + OS-keychain layer lands in `src-tauri`,
keys move out of memory and into the OS keychain.

## Name your AI

Open **Persona** in the desktop window. The default name is **Milo** with
the wordmark avatar. Change the name, tone, depth, format, "avoid" list,
and memory mode (`auto` / `review` / `manual` / `off`). The change applies
to the next chat turn.

You can also import a preset:

```bash
n0tune persona import personas/developer-mentor.n0tune.json
```

## Where things live on disk (planned)

When the Rust storage layer lands, N0Tune Desktop will store data here:

| OS       | Location                                              |
| -------- | ----------------------------------------------------- |
| macOS    | `~/Library/Application Support/N0Tune/n0tune.db`      |
| Windows  | `%APPDATA%\N0Tune\n0tune.db`                          |
| Linux    | `~/.local/share/n0tune/n0tune.db`                     |

The database is SQLite. The schema mirrors the Gateway's pgvector schema
so the same Context Compiler runs in both modes.

## What's still stubbed

- The SQLite + keychain layer in `src-tauri/src/lib.rs`. The renderer's
  `LocalStubBackend` is the source of truth for now.
- macOS/Windows signed releases.
- Floating widget / tray icon (`docs/floating-widget.md`).

Everything else — onboarding, chat, memory viewer, context preview, persona
settings, provider settings, real Anthropic/Gemini calls — is wired and
working today.
