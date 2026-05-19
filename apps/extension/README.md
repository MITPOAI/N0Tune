# N0Tune browser extension (v0.1.5 scaffold)

WebExtension (Manifest v3) that brings N0Tune memory into the
**claude.ai** and **chat.openai.com** web UIs. Same memories as the
N0Tune Desktop app and the MCP server — different surface.

> **Status: scaffold only.** v0.1.5 ships the popup config UI, the
> background worker, and the manifest. **DOM injection on claude.ai
> and chat.openai.com is week-2 work** — see
> [the v0.2 plan](../../README.md) and `src/content/index.ts`.

## What works today (v0.1.5)

- Popup UI: enable/disable, Gateway URL, app_id, user_id, API key.
- "Test connection" button hits `GET /health` and shows latency.
- Background service worker: handles `n0tune.compile`, `n0tune.save`,
  `n0tune.health` messages from content scripts.
- Content script: loads on both platforms, confirms the background
  channel works in DevTools.

## What's still ahead (v0.2 week 2)

- DOM hooks on claude.ai that find the chat input and intercept send.
- DOM hooks on chat.openai.com / chatgpt.com (different DOM).
- End-of-session save pill ("Save anything from this session?").

## Install (developer mode)

```bash
# From repo root
npm install
npm --workspace apps/extension run build

# Chrome / Edge:
#   1. Open chrome://extensions
#   2. Toggle "Developer mode" (top right)
#   3. Click "Load unpacked"
#   4. Pick: apps/extension/dist/
#
# Firefox:
#   1. Open about:debugging#/runtime/this-firefox
#   2. Click "Load Temporary Add-on..."
#   3. Pick: apps/extension/dist/manifest.json
```

After install, click the extension icon, point Gateway URL at your
running N0Tune Gateway (`http://localhost:8000` by default), set
`user_id` and `app_id`, hit **Save**, then **Test connection**.

## How it'll work (target architecture)

```
Claude.ai textarea
   ↓ (user types, hits send)
content.js intercepts
   ↓ chrome.runtime.sendMessage({type:"n0tune.compile", message})
background.js
   ↓ fetch http://localhost:8000/v1/context/preview
N0Tune Gateway compiles memories + style + chunks
   ↑ ContextPreview
content.js prepends compiled context as a hidden first message
   ↓ original send fires
Claude.ai sees a normal prompt with personal context
   ↓
Personal answer
```

No data leaves your machine unless the Gateway's provider call goes to
a remote model — the extension itself only talks to your local
Gateway.

## Why the extension exists

Platform memory (ChatGPT, Claude Projects) is **locked to the
platform**. Switch from Claude to ChatGPT and the AI forgets you. This
extension carries the same N0Tune memory store across both — same
memories, same persona, no platform lock-in.

It's also the **distribution** answer to "but Claude already has
memory" — the extension drops N0Tune *in front of* the platform's own
memory, so users get N0Tune's benefits without leaving the chat
surface they already use.

## Code map

```
apps/extension/
├── public/
│   └── manifest.json         # Manifest V3 (Chrome + Firefox)
├── popup.html                # Action popup shell
├── src/
│   ├── popup/                # React popup UI
│   ├── background/           # Service worker (message router)
│   ├── content/              # Page-scope content script (stub)
│   └── lib/                  # config + gateway helpers
├── tsconfig.json
├── vite.config.ts
└── package.json
```

## License

Same as the parent repo (open source).
