# Concept alignment — dashboard v0.1.6

This doc maps the maintainer's `Concept.png` for the N0Tune Command Center
to what actually shipped in `apps/dashboard` for the v0.1.6 pass. It is a
concept-to-shipped trace, intended for future contributors who want to
know what is honest, what is wired to real state, and what is still
genuinely planned.

Companion doc: [`docs/dashboard-gap-analysis.md`](./dashboard-gap-analysis.md).
That file is the older gap analysis; this file documents the alignment
push that closed most of the visible gaps.

Source files referenced throughout:

- `apps/dashboard/components/dashboard-app.tsx` — single 4880-line file
  with every dashboard component. Line numbers below are stable as of
  v0.1.6.
- `apps/dashboard/app/globals.css` — CSS primitives (`.topbar-icon`,
  `.context-ring`, `.pressure-bar`, `.category-tile`, `.quick-tile`, etc).
- `apps/dashboard/public/n0va.svg` — the hooded N0va mascot asset.

## Conventions used in this doc

- "Concept" = what the PNG shows.
- "Shipped" = what the React code renders, with file + line refs.
- "Real / Planned" = whether the value is derived from live API state or
  is a deliberate placeholder.

## Codex follow-up audit - 2026-05-23

`Concept.png` was not present in this checkout during the Codex handoff
(`Get-ChildItem -Recurse` found only this doc and existing dashboard
screenshots), so this pass used the saved Claude memory
`mem_16f5a61278ed4efbb4b2d2f6c77141b4` and the explicit deltas in
`docs/codex-handover.md` rather than a direct image overlay.

Applied deltas:

- Companion avatar/mascot bubble: removed the visible inner border and kept
  only the soft cyan glow (`.companion-orb`).
- Memory Library and Quick Actions inner tiles: transparent fill with a
  1 px ice-line border; hover adds only a subtle tint.
- Context Health ring and Token Savings arc: stroke reduced from 10 px to
  8 px.
- Recent Sessions pressure bars: height reduced from 8 px to 6 px.
- Chips: visible border removed; chips now use a soft fill and active fill.
- Mobile: sticky-top sidebar is replaced below 768 px by a bottom tab bar
  plus drawer sheet. The intended smoke viewport is 390 x 844 with no
  horizontal overflow.

## Codex direct image audit - 2026-05-24

The maintainer supplied the actual concept image at
`C:/Users/Danny/Downloads/Concept.png`. This pass compared that image
against the live dashboard and kept the previous functional constraints:
no Discord link, no fake provider model, no fake dollar savings, and the
Quick Actions labels that avoid Playwright strict-mode collisions.

Applied deltas:

- Companion card: restored the desktop horizontal composition from the
  concept: large mascot halo on the left, companion copy and CTAs on the
  right. Mobile still stacks vertically.
- Command Center grids: use three columns only at wide desktop sizes so
  the card content does not cramp on 1280 px screens.
- Fetch error handling: dashboard refresh now replaces stale errors by
  scope instead of appending duplicate errors after repeated failed
  refreshes.

Intentional deviations from the concept image:

- Current Model & Routing still says "Configured via env" until the
  gateway exposes a live provider endpoint.
- Token Savings cost still says "planned" until provider pricing data
  exists.
- Footer keeps Docs / Roadmap / Contribute only. Discord stays absent
  until MITPOAI publishes an official URL.
- Quick Actions keep "Tune Context" and "Index a doc or note" to avoid
  Playwright locator collisions with the context submit button and Files
  navigation.

---

## 1. Command Center hero — Companion card

### Concept

Hooded N0va mascot in a circular halo, label "Your Companion", name
"N0va", tagline "At your service.", two CTAs ("Chat with N0va" primary,
"Companion Settings" secondary), a mood pill underneath the avatar.

### Shipped

`CompanionCard` in `apps/dashboard/components/dashboard-app.tsx:1662-1734`.

| Concept element              | Shipped wiring                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Hooded mascot                | `Image src="/n0va.svg"` at lines 1688-1694. Asset: `apps/dashboard/public/n0va.svg`.                 |
| User-uploaded avatar         | `<img src={avatar}>` at 1681-1686, set by file input in `SettingsPage` (Companion section).          |
| Halo + glow                  | `border-memory/40 bg-[#07131f] shadow-[0_0_42px_rgba(77,225,210,0.32)]` at line 1679.                |
| Mood pill                    | `<StatusPill>` at 1697-1703, fed by `companionMood(health, memories, documents, preview)` (line 4784).|
| Name "N0va" default          | `companionName` state defaults to `"N0va"` (line 372), persisted to `localStorage` key `n0tune.companion.name`. |
| "Your Companion / At your service." | Lines 1705-1709.                                                                              |
| "Chat with N0va" primary CTA | Line 1714-1720, calls `onChat → onNavigate("context-lab")` (Context Lab).                            |
| "Companion Settings" CTA     | Line 1722-1729, calls `onSettings → onNavigate("settings")`.                                         |

Notes:

- Avatar upload accepts PNG / JPG / SVG / WebP up to 1 MB
  (`handleCompanionAvatarFile`, lines 398-424).
- Both name and avatar persist in `localStorage` keys
  `n0tune.companion.name` and `n0tune.companion.avatar` (lines 378-396).

---

## 2. Context Health card

### Concept

A circular ring with the score in the middle, a label ("Excellent"), and
a 5-item metric checklist with percentages: Freshness, Relevance,
Density, Coherence, Coverage.

### Shipped

`ContextHealthCard` at `dashboard-app.tsx:1736-1777`, ring SVG at
`Ring` (lines 1779-1822), computation at `contextHealthBreakdown`
(lines 2318-2401).

| Metric    | Formula (real, not faked)                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Freshness | `% of memories whose updated_at < 7 days old` (lines 2327-2333).                                       |
| Relevance | `avg(similarity)` over `preview.selected_memories ∪ preview.selected_chunks` (lines 2335-2347).        |
| Density   | `aggregate tokens_saved / (tokens + saved)` across all `context_runs` (lines 2349-2360).               |
| Coherence | `% of memories with last_confirmed_at != null` (lines 2362-2367).                                      |
| Coverage  | `min(100, total_chunks / 12 * 100)` — 12 chunks is the implicit "good coverage" budget (lines 2369-2370).|
| Score     | Weighted sum (0.2 / 0.2 / 0.25 / 0.2 / 0.15), multiplied by 0.6 if gateway is not OK (lines 2372-2379).|
| Label     | "Excellent" ≥ 85, "Healthy" ≥ 70, "Stable" ≥ 50, "Watch" ≥ 30, else "Needs setup" (lines 2381-2386).   |

CSS primitives:

- `.context-ring` at `globals.css:532-545` provides the centered overlay
  for the value text.
- The arc itself uses an SVG `<circle>` with `strokeDasharray` set from
  `circumference - (score/100)*circumference` (Ring component,
  lines 1779-1822).

---

## 3. Current Model & Routing card

### Concept

Provider logo + model name + PRIMARY badge, "via N0Tune Router" label,
Smart routing toggle, fallback chain (Anthropic → OpenAI → Gemini →
OpenRouter), "Manage Models & Routing" link, "Change" button.

### Shipped

`ModelRoutingCard` at `dashboard-app.tsx:1824-1886`.

Honesty caveats baked into the UI:

- The current configured provider is shown as **"Configured via env"**
  (line 1844), not a real model name. The gateway does not yet expose
  `GET /v1/providers/current`, so the dashboard does not lie about which
  model is live.
- The card explicitly tells the reader: *"Live model introspection (GET
  /v1/providers/current) is planned. Set `N0TUNE_PROVIDER_*` env vars
  before `docker compose up`."* (lines 1870-1875).
- The PRIMARY pill is a static `StatusPill tone="info"` (line 1847).
- Smart routing pill is hard-coded as `enabled` (lines 1853-1858) — it
  reflects gateway behaviour today (gateway always falls back), not a
  user toggle.

Fallback chain renders as four `.chip` spans separated by `→`
(lines 1861-1869). "Change" button (top right) and "Manage Models &
Routing →" both call `onManage → onNavigate("models")`.

---

## 4. Memory Library card

### Concept

4 category tiles (Core Memories / Projects / References / Preferences),
each with an icon, count, and label. Footer line: "Total items · Updated
Xm ago".

### Shipped

`MemoryLibraryCard` at `dashboard-app.tsx:1888-1951`.

| Tile           | Icon (lucide-react) | Count source                                                                                          |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| Core Memories  | `Brain`             | `memories.length` (line 1897).                                                                        |
| Projects       | `FolderKanban`      | `memoryStats(memories).projects` (line 1898; helper at lines 4703-4783).                              |
| References     | `BookOpen`          | `total - preferences - projects - style - goals`, clamped at ≥ 0 (line 1899).                         |
| Preferences    | `Sliders`           | `memoryStats(memories).preferences` (line 1900).                                                      |

CSS: `.category-tile` and `.category-tile__icon` at
`globals.css:577-603` give each tile the rounded glass background and
icon halo.

Footer (lines 1942-1948):

- "Total: N items · Updated Xm ago"
- `formatRelative(memories[0].updated_at)` — `formatRelative` at lines
  2307-2316 returns "just now" / "Nm ago" / "Nh ago" / "Nd ago".

"View Library →" link (lines 1916-1922) calls
`onView → onNavigate("memory")`.

---

## 5. Token Savings card

### Concept

A half-ring "Saved" arc meter showing a percentage, a list (tokens saved,
tokens used, cost saved $X), and a "30 Days" range selector.

### Shipped

`TokenSavingsCard` at `dashboard-app.tsx:1953-2007`. Arc renderer
`ArcMeter` at lines 2009-2058.

| Concept element        | Shipped wiring                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Saved arc meter        | `ArcMeter percent={pct}` (line 1973). `pct = totalSaved / (totalSaved + totalTokens) * 100`.    |
| Tokens saved           | `savingsAgg.totalSaved.toLocaleString()` (lines 1976-1980), sums real `prompt_tokens_saved_estimated` across `context_runs`. |
| Tokens used            | `savingsAgg.totalTokens.toLocaleString()` (lines 1981-1986), sums real `prompt_tokens_estimated`.|
| Cost saved             | `"—"` with a `planned` chip (lines 1987-1993). Provider pricing data is not in the system yet.  |
| 30 Days selector       | Replaced with a `{contextRuns.length} runs` chip (lines 1968-1971) — we don't fake a window.    |

`aggregateRuns` lives at `dashboard-app.tsx:3614` and walks
`context_runs` to compute totals.

No fake "68%" anywhere. If there are zero runs, the meter shows 0%.

CSS: `ArcMeter` reuses `.context-ring` for the centered overlay
(lines 2018-2056).

---

## 6. Security Status card

### Concept

A green "Secure" pill in the corner, plus 5 rows:

1. Local Runtime
2. Data Encryption
3. Secrets Vault
4. Network Access
5. Plugin Permissions

### Shipped

`SecurityStatusCard` at `dashboard-app.tsx:2060-2120`.

| Row                | Live signal                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Local Runtime      | `health?.status === "ok" ? "Running" : "Checking"` (lines 2074-2078).                                          |
| Data Encryption    | Static "Postgres + OS keychain" (line 2079) — honest one-liner of the persistence story.                       |
| Secrets Vault      | Static "Locked" (line 2080).                                                                                   |
| Network Access     | `preview.warnings.length` from `/v1/context/preview`. Shows "N warnings" or "Restricted" (lines 2082-2085).    |
| Plugin Permissions | `riskyChunkCount(documents)`. Shows "N risky chunks" or "Least Privilege" (lines 2086-2090).                   |

"Open Security Center →" (line 2111-2117) calls
`onOpen → onNavigate("security")`.

---

## 7. Recent Sessions + Danger Zone

### Concept

4 rows with title / project / time / model, each with a colored Context
Pressure progress bar (red 91 / orange 74 / yellow 43 / green 22) and an
"Enter DZ" button. A warning line: "Danger Zone detects high context
pressure that may impact output quality."

### Shipped

`RecentSessionsCard` at `dashboard-app.tsx:2122-2216`.

| Concept element             | Shipped wiring                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Real session list           | `runs.slice(0, 4).map(...)` over real `context_runs` (line 2151).                                                |
| Context Pressure %          | `pct = round(tokens / 8000 * 100)` clamped to 2..100 (line 2153). 8k is the reference budget.                    |
| Color bands                 | `band = critical ≥ 95 / danger ≥ 80 / watch ≥ 60 / safe < 60` (lines 2154-2161).                                 |
| Pressure bar                | `.pressure-bar[data-band="..."]` with a child `<span>` whose width is `${pct}%` (lines 2186-2188).               |
| Per-row "Open" button       | Calls `onEnter → onNavigate("sessions")` (lines 2189-2195).                                                      |
| Danger Zone warning footer  | `text-warning` line + "Learn more →" anchor (lines 2207-2213).                                                   |
| Empty state                 | `<EmptyState title="No context runs yet">` if there are no runs (lines 2200-2205).                               |
| "View All Sessions →"       | Top-right link (lines 2141-2147), calls `onViewAll → onNavigate("sessions")`.                                    |

CSS: `.pressure-bar` and its `data-band="safe|watch|danger|critical"`
variants live at `globals.css:605-633`. Colors come from the unified
palette (success green / warning amber / danger red / memory teal).

What is NOT yet shipped vs concept:

- No per-session "title" or "project" because there is no
  session-summary endpoint. We show the truncated `request_id` and
  `user_id` instead — honest.
- No per-row model attribution (same reason — provider attribution per
  run isn't recorded yet).

---

## 8. Quick Actions tiles

### Concept

A 2x3 grid: New Session / Tune Context / Import Memory / Run
Evaluation / Create Handoff / View Audit Logs. A "Customize Dashboard"
button at the bottom.

### Shipped

`QuickActionsCard` at `dashboard-app.tsx:2218-2305`.

| Tile             | Icon (lucide-react) | Navigates to                                  |
| ---------------- | ------------------- | --------------------------------------------- |
| New Session      | `Plus`              | `context-lab`                                 |
| Tune Context     | `Sparkles`          | `context-lab`                                 |
| Import Memory    | `Download`          | `files`                                       |
| Run Evaluation   | `ListChecks`        | `context-lab`                                 |
| Create Handoff   | `Network`           | `handoff` (page is the planned-features stub) |
| View Audit Logs  | `ScrollText`        | `audit`                                       |

CSS: `.quick-tile` + `.quick-tile__icon` at `globals.css:635-665`.

"Customize Dashboard" at lines 2296-2302 navigates to `settings`. There
is also a tiny `synced` / `refreshing` pill in the card header
(line 2272-2274) that reflects the global `loading` state.

---

## 9. Sidebar

### Concept

Three grouped sections (Control / Capabilities / Governance) with an
icon next to each item. Version + GitHub link at the very bottom.

### Shipped

`NAV_GROUPS` at `dashboard-app.tsx:195-307`. Sidebar JSX at lines
977-1076.

| Group        | Items (key → icon)                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Control      | command → `LayoutDashboard`, context-lab → `FlaskConical`, memory → `Library`, sessions → `GitBranch`, handoff → `Network` |
| Capabilities | models → `Cpu`, files → `FileText`, mcp → `Plug`, cache → `Database`                                           |
| Governance   | security → `ShieldCheck`, audit → `ScrollText`, settings → `SettingsIcon`                                      |

Bottom block (`dashboard-app.tsx:1044-1075`):

- N0Tune CLI status card with `Terminal` icon + "v0.1.6 · Up to date".
- "View on GitHub" link block (inline GitHub SVG, href to the repo).
- Final tagline: **"Open source · MIT · No telemetry"**.

Each nav button also renders a `StatusDot` (line 4685) that signals
`live` / `partial` / `planned` for the section.

---

## 10. Topbar

### Concept

Pitch line "Bring any model. N0Tune makes it yours." + Runtime Online
green pill + Sync button + Terminal/Docs button + Notifications badge
(3) + AV avatar with dropdown.

### Shipped

`AppShell` topbar at `dashboard-app.tsx:1078-1139`.

| Concept element        | Shipped wiring                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pitch line             | Lines 1081-1086.                                                                                                           |
| Runtime Online pill    | `<StatusPill tone={statusTone} dot>` driven by `health?.status === "ok"` (lines 1088-1090).                                 |
| Deployment mode pill   | `DeploymentPill` (lines 1345-1358) → `Local` / `Self-hosted` / `Custom endpoint` based on host of `apiBaseUrl`.            |
| Sync button            | `RotateCw` icon, calls `onRefresh` (lines 1092-1101). `.topbar-icon` class.                                                |
| Command palette ⌘K     | `Search` icon (lines 1102-1111). Triggers `paletteOpen` and the `CommandPalette` (lines 1403-1492).                       |
| Terminal / Docs        | `Terminal` icon link to `http://localhost:8000/docs` (lines 1112-1121).                                                    |
| Notifications badge    | `Bell` icon with `.topbar-badge` showing `3` (lines 1122-1131). For now it routes to the palette — see TODOs below.       |
| AV avatar + dropdown   | `IdentityMenu` at lines 1211-1278. Avatar uses `.topbar-avatar`. Popover uses `.identity-popover` (globals.css:518-530). |

The identity popover holds the `App ID` and `User ID` text inputs that
were previously in the topbar. Stored per-browser in `localStorage`.

CSS primitives: `.topbar-icon` (`globals.css:458-479`), `.topbar-badge`
(`globals.css:481-495`), `.topbar-avatar` (`globals.css:497-516`),
`.identity-popover` (`globals.css:518-530`).

---

## 11. Footer

### Concept

"N0Tune is open source · Built by the community, for builders." + Docs /
Discord / Roadmap / Contribute links + "Runtime Path: ~/notune/runtime"
+ "System Healthy" pill.

### Shipped

`AppShell` footer at `dashboard-app.tsx:1170-1205`.

| Concept link | Shipped href                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Docs         | `https://github.com/MITPOAI/N0Tune#readme` (line 1175).                                                  |
| Roadmap      | `https://github.com/MITPOAI/N0Tune/blob/main/docs/product-direction.md` (line 1183).                     |
| Contribute   | `https://github.com/MITPOAI/N0Tune/blob/main/CONTRIBUTING.md` (line 1191).                               |
| Discord      | **Not yet added.** See TODOs.                                                                               |
| Runtime path | Replaced with `gateway: <host>` showing the actual API base URL (line 1198) — more honest than a path lie.  |
| System Healthy pill | `<StatusPill tone={statusTone} dot>` line 1201, fed by the same `health.status` as the topbar.       |

---

## 12. What is still genuinely planned

These are the items the v0.1.6 pass deliberately did **not** ship, with
the rationale.

| Area                          | Status   | Why deferred                                                                                          |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `GET /v1/providers/current`   | Planned  | No endpoint exists. ModelRoutingCard labels itself "Configured via env" instead of faking a model.    |
| `POST /v1/providers/test`     | Planned  | "Test connection" / "Change provider" forms in the dashboard depend on this.                          |
| Provider price data           | Planned  | Required for Token Savings card to show a real `$X cost saved`. Today the row shows "— planned".      |
| Handoff Capsules backend      | Planned  | `handoff_capsules` table, `/v1/handoffs`, and 3 MCP tools are designed (see gap-analysis doc) but not implemented. The Handoff sidebar item has a `planned` status dot. |
| Session-summary endpoint      | Planned  | Recent Sessions card uses `context_runs` + truncated request IDs because there is no per-session summary yet. |
| Per-session token tracking    | Planned  | Tokens are aggregated across runs, not per session — same root cause as above.                        |
| Real notifications source     | Planned  | Bell badge says `3` and currently opens the command palette. Once notifications exist, wire to a real source. |
| Discord URL in footer         | Planned  | Footer currently has Docs / Roadmap / Contribute. Discord channel link still needs to be picked.      |
| Bottom-nav drawer for mobile  | Shipped  | Below 768 px the dashboard uses a fixed bottom tab bar and drawer sheet. |

---

## 13. Smoke evidence collected during this pass

- **Docker stack:** `docker compose up -d --wait` brings up `postgres`,
  `redis`, `api`, and `dashboard`. All four containers reported healthy.
- **MCP round-trip:** `claude mcp list` shows `n0tune ✓ Connected`.
  `n0tune_save_memory` and `n0tune_search_memories` both round-tripped
  through the gateway during this session.
- **Memory API:** create / list / search / confirm / patch / delete all
  exercised through the dashboard against the running gateway.
- **Documents:** create + chunk-listing exercised via the Files page.
- **Cache:** list + clear via the Cache page.
- **Context Preview:** `/v1/context/preview` exercised both from
  Command Center "Quick context preview" and from Context Lab for two
  users side-by-side.
- **Audit:** `/v1/audit-logs` returns entries when called with an
  owner/admin `X-N0Tune-API-Key`.
- **Playwright e2e:** 5/5 green
  (`apps/dashboard/e2e/dashboard.spec.ts`).
- **Build:** approximately `27.8 kB` page bundle / `~130 kB` First Load
  JS for the dashboard route. (Re-check `npm run build` output after
  any later edits; treat these numbers as approximate.)

---

## TODOs from this pass

- [ ] Add a real Discord URL to the footer (currently absent).
- [ ] Implement `GET /v1/providers/current` so `ModelRoutingCard` can
      show the live provider + model instead of "Configured via env".
- [ ] Implement `POST /v1/providers/test` and surface a "Test
      connection" affordance on the Models page.
- [ ] Add provider pricing data so `TokenSavingsCard` can replace the
      "— planned" cost-saved row with a real $ figure.
- [ ] Wire `Bell` notifications to a real notification source instead
      of routing to the command palette.
- [ ] Ship the Handoff Capsules backend (`handoff_capsules` table,
      `/v1/handoffs` routes, 3 MCP tools) so the Handoff sidebar item
      can move from `planned` to `live`.
- [ ] Ship a session-summary endpoint so `RecentSessionsCard` can show
      real titles / projects / models per session instead of truncated
      request IDs.
- [x] Build a true mobile bottom-nav drawer to replace the sticky-top
      sidebar on narrow viewports.
- [ ] Confirm bundle sizes with a fresh `npm run build` after any
      further dashboard edits — the numbers in section 13 are
      approximate.
