# Codex handover — pick up the v0.1.6 dashboard pass

This is a Claude → Codex handover. The whole point of N0Tune is that this
file should be unnecessary because the MCP tools carry the context. The
doc still exists for the human in the loop.

Repo: <https://github.com/MITPOAI/N0Tune>
Owner: MITPOAI

---

## Quickstart (paste into Codex CLI)

```bash
# 1. From the repo root, register the N0Tune MCP server with Codex.
#    This writes ~/.codex/config.toml so Codex can call n0tune_*.
cat >> ~/.codex/config.toml <<'EOF'

[[mcp_servers]]
name = "n0tune"
command = "node"
args = ["./integrations/mcp-server/src/server.mjs"]

[mcp_servers.env]
N0TUNE_API_BASE_URL = "http://localhost:8000"
N0TUNE_API_KEY = "replace-with-local-development-key"
N0TUNE_APP_ID = "demo"
N0TUNE_USER_ID = "william.forveo@gmail.com"
EOF

# 2. Make sure the Gateway + dashboard + postgres + redis are up.
docker compose up -d --wait

# 3. Smoke-check that Codex can see N0Tune memories from this session.
#    Inside Codex, run:
#       /tools  # should list n0tune_search_memories, n0tune_save_memory, etc.
#       Then ask Codex: "Use n0tune_search_memories to find HANDOFF-CLAUDE-TO-CODEX"
#    Codex should return the v0.1.6 handoff memory mem_16f5a612*.
```

## Paste this prompt into Codex to start the next session

> You are picking up a v0.1.6 dashboard pass on the N0Tune project
> (`github.com/MITPOAI/N0Tune`). Claude shipped the structural redesign
> (lucide icons, hooded N0va mascot SVG, 3-column Command Center,
> CompanionCard, ContextHealthCard with ring + 5-metric checklist,
> ModelRoutingCard, MemoryLibraryCard 4-tile, TokenSavingsCard arc meter,
> SecurityStatusCard, RecentSessionsCard with colored pressure bars,
> QuickActionsCard 2×3, command palette, deployment-mode pill,
> Settings → Companion with avatar upload). Docker stack is healthy,
> Playwright e2e is 5/5 green.
>
> Before you touch any code: call `n0tune_search_memories` for
> "HANDOFF-CLAUDE-TO-CODEX" — that retrieves the explicit punch list and
> file map Claude left for you (memory id starts with `mem_16f5a612`). If
> the MCP tools aren't visible, ask the user to follow the Quickstart in
> `docs/codex-handover.md`.
>
> Your job (in this order, each as its own commit):
>
> 1. **Mobile polish (< 768 px)** — convert the sticky-top sidebar to a
>    bottom-nav drawer or compact sheet. Verify no horizontal overflow
>    at 390 × 844. Touch targets ≥ 44 px. Files:
>    `apps/dashboard/components/dashboard-app.tsx`,
>    `apps/dashboard/app/globals.css` (add `@media (max-width: 767px)`
>    rules for `.shell-sidebar`, `.shell-topbar`, the 3-column grids).
>
> 2. **Concept-image pixel audit** — open `Concept.png` (maintainer
>    attached it at the start; if you don't have it, ask). Compare
>    against the live dashboard at `http://localhost:3000`. For every
>    card, log the deltas:
>    icon variant, icon stroke weight, icon size,
>    gradient direction and stops, glow radius, border weight, padding,
>    rounded-corner radius, internal divider lines. Then fix them.
>    Specific concerns Claude flagged:
>    - Companion card should have NO inner borders around the mascot
>      bubble; just the soft cyan glow.
>    - Stat tiles inside Memory Library / Quick Actions should be
>      transparent (no fill) with a 1 px ice-line border instead.
>    - Ring stroke is currently 10 px — concept looks closer to 8 px.
>    - Pressure-bar height is currently 8 px — concept is 6 px.
>    - Chip border is currently 1 px solid `--line` — concept uses no
>      visible border, just a soft fill.
>
> 3. **Tauri Desktop GitHub update check** — in
>    `apps/desktop/src-tauri/src/lib.rs`, add a startup command that
>    `GET`s `https://api.github.com/repos/MITPOAI/N0Tune/releases/latest`,
>    parses the `tag_name`, compares with the bundled version (read from
>    `Cargo.toml`), and emits a Tauri event `n0tune://update-available`
>    when a newer semver is published. On the renderer side, surface
>    this as a small toast in the dashboard footer.
>    Do not auto-download — just link to the release URL.
>
> 4. **Robustness sweep** — every fetch in `dashboard-app.tsx` should
>    have a per-call error path that shows a `<ErrorState>` instead of
>    silently swallowing. Add a global error boundary at the AppShell
>    level. Memoise everything that recomputes on every render
>    (`aggregateRuns`, `contextHealthBreakdown`, `memoryQuality`,
>    `companionMood`).
>
> 5. **Verify** — `npm run lint`, `npm run typecheck`, `npm test`,
>    `npm run build`, `npx playwright test` must all stay green.
>    Re-run `n0tune_alignment_check` at the end with your summary.
>    Save a memory at the end via `n0tune_save_memory` describing
>    what shipped so Cursor / the next tool can continue.
>
> Constraints from Claude's pass:
> - The repo is `MITPOAI/N0Tune`. Don't reintroduce the old wrong owner URL.
> - No Discord link until MITPOAI publishes one.
> - StyleEditor must stay controlled — do not re-add a timestamp-derived
>   remount key; the e2e suite fails if you do.
> - Quick Actions tile "Tune Context" must stay; "Compile Context" would
>   collide with the form submit button name in Playwright strict mode.
> - "Import Memory" tile body must stay "Index a doc or note" — "Add
>   files or URLs" collides with the "Files" nav button.
> - Companion avatar + name persist in `localStorage` only; never POST
>   them to the Gateway.
> - Token Savings cost-saved row stays "— planned" until a provider
>   pricing table is added.

---

## What's done in v0.1.6

| Area | Status |
|---|---|
| Docker stack (postgres + redis + api + dashboard) | Healthy on `:5432 / :6379 / :8000 / :3000` |
| MCP wiring | `claude mcp list` → `n0tune ✓ Connected`. 8 tools live |
| Playwright e2e | 5 / 5 green in 10.8 s |
| Lint / typecheck / vitest / build | All green. Bundle 34.8 kB / 137 kB First Load |
| Sidebar | 12 pages, lucide icons, 3 groups, CLI status block, GitHub block |
| Topbar | Pitch, Runtime Online pill, deployment-mode pill, Sync, ⌘K palette, /docs link, Bell with badge, Avatar |
| Command Center | 3-col grid with all 7 cards from the concept |
| N0va mascot | `apps/dashboard/public/n0va.svg`, 4.2 kB |
| Companion name + avatar import | Settings → Companion, localStorage only |
| Context Health | Ring + 5 metrics, real numbers from `contextHealthBreakdown()` |
| Memory Library card | 4 category tiles |
| Token Savings card | Arc meter, real numbers, cost saved labelled planned |
| Recent Sessions | Colored pressure bars from real context_runs |
| Quick Actions | 2 × 3 tile grid + Customize Dashboard button |
| Footer | Docs / Roadmap / Contribute + runtime path + system pill |

## What's still Planned (needs backend or fresh work)

| Item | Why |
|---|---|
| Handoff Capsules | No `handoff_capsules` table, no `/v1/handoffs`, no 3 MCP tools |
| Session-summary endpoint | `conversations` / `messages` exist but no summary route |
| `GET /v1/providers/current` + `POST /v1/providers/test` | Required for live model name on Command Center and Test Connection on Models |
| Provider price data | Required for real Token Savings cost saved $ |
| Live MCP handshake | Stdio servers boot from their client; dashboard can only probe Gateway |
| Bottom-nav drawer for true mobile | Sidebar sticky-top is the current placeholder |
| Desktop GitHub update check | Tauri side not implemented |

## Files Codex will touch most

- `apps/dashboard/components/dashboard-app.tsx` — single 4.7 k-line file
- `apps/dashboard/app/globals.css` — design tokens + primitives
- `apps/dashboard/app/layout.tsx` — root, viewport, theme color
- `apps/desktop/src-tauri/src/lib.rs` — Tauri commands and events
- `apps/desktop/src/` — Tauri renderer (Vite + React)
- `apps/dashboard/public/n0va.svg` — mascot
- `docs/concept-alignment.md` — the design audit doc, update as you go
- `docs/dashboard-gap-analysis.md` — brief-vs-state mapping
- `CHANGELOG.md` — append a `0.1.7` block when you ship

## Verification commands (copy-paste)

```bash
# Dashboard
cd "C:/Dev/IMME internal/N0Tune/apps/dashboard"
npm run lint        # eslint --max-warnings=0
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # next build, check First Load JS
docker compose up -d --build dashboard
npx playwright test --reporter=list   # against the live Docker stack

# Gateway smoke
curl -fsS http://localhost:8000/health?deep=true
curl -fsS "http://localhost:8000/v1/context-runs?app_id=demo&limit=5" | python -m json.tool

# Desktop (if Codex touches Tauri)
cd ../desktop/src-tauri && cargo check
cd .. && npm run lint && npm test
```

## MCP loop — proof Codex can verify in one minute

```
# In a Codex session with the N0Tune MCP wired:
"Use n0tune_search_memories with query 'HANDOFF-CLAUDE-TO-CODEX' and limit 1."
# Codex calls the tool, returns mem_16f5a61278ed4efbb4b2d2f6c77141b4 with the v0.1.6 punch list.

"Use n0tune_save_memory with text 'Codex picked up the v0.1.6 handoff at <timestamp>.' type 'project' confidence 0.95."
# Codex writes a new memory.

# Then in any other tool (Claude Desktop / Cursor) with the MCP wired:
"Use n0tune_search_memories for 'Codex picked up' — verify it round-trips."
# The Codex-written memory appears.
```

That round-trip is the whole point of N0Tune. If it works, the handoff is
proven end-to-end across Claude → Codex → next tool.
