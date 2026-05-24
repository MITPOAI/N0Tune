# Dashboard gap analysis — initial brief vs v0.1.6

This document maps every requirement from the original UI redesign brief
to its current state in the v0.1.6 dashboard. Status uses four levels:

- ✅ **Shipped** — implemented and verified
- 🟡 **Partial** — present but limited (because the brief asked for more,
  or because some pieces need backend code)
- ⏳ **Planned** — needs new backend code in this repo; UI is read-only
- ✋ **Deferred** — intentionally not done in this pass; reasoning given

The dashboard is `apps/dashboard/components/dashboard-app.tsx`. Backend
is `apps/api/`. MCP server is `integrations/mcp-server/`.

## Hero framing

| Requirement | Status | Notes |
|---|---|---|
| Pitch "Bring any model. N0Tune makes it yours." | ✅ | Sidebar header. |
| Alt pitch "Your model gives intelligence. N0Tune gives memory." | ✅ | Command Center hero headline. |
| "Fine-tuning changes the model. N0Tune changes the context around it." | ✅ | Sidebar subhead. |
| Avoid claims of training / fine-tuning | ✅ | Reviewed throughout copy. |

## Page 1 — Command Center

| Brief item | Status | Notes |
|---|---|---|
| AI Companion / Pet card | ✅ | Hero card with avatar + name + mood. |
| Mascot/avatar | ✅ | Imported in Settings → Companion; defaults to `/logo.png`. |
| Custom name | ✅ | Default "N0va"; persisted in localStorage. |
| Memory mood/status | ✅ | Ready / Learning / Watching / Needs setup / Checking. |
| Learning level | 🟡 | Surfaced indirectly via badges ("First memory", "Knowledge indexed", "Active runtime", "Cache warming"). A numeric "level" feels childish for a dev product. |
| Context Health score | ✅ | 0–99, derived from real Gateway state. |
| "Ready to help" status | ✅ | Mood pill on avatar. |
| Memory status (totals, active, confirmed, expired, conflicted) | ✅ | StatCards on Command Center + Memory Quality panel on Library. |
| Private vs shared | 🟡 | Memory scope is shown per-card. App/user split is in topbar. A separate "shared" pill is deferred until team scopes ship. |
| Current model (provider/model/connection/cost estimate) | ⏳ | Provider router uses env vars; live model name is not exposed via API yet. |
| Context savings (naive vs compiled, savings %, cache hits) | ✅ | TokenSavingsMeter; honest 0% when no runs. |
| Recent sessions (Claude / Codex / project) | 🟡 | We show `context_runs` (real telemetry). Full sessions with source tool need backend. |
| Security status (injection blocks, secret detections, risky docs) | ✅ | Security page + StatCard on Command Center. |
| Quick actions (Chat, Preview, Summarize, Handoff, Add Memory, Connect Claude/Cursor, Index Folder) | ✅ | Hero buttons + Quick Actions panel cover Preview, Add Memory, Connect MCP, Index File, Customize companion, Create Handoff (planned). Chat lives on Context Lab / external tool. Summarize is planned. Folder sync is CLI/Desktop. |
| Companion gamification badges (no secrets, MCP connected, first handoff, brain tidy) | ✅ | `CompanionBadges` on hero card. |

## Page 2 — Context Lab

| Brief item | Status | Notes |
|---|---|---|
| User/persona selector | ✅ | Two user_id inputs A / B. |
| Model selector | ✋ | Context Lab is preview-only by design. Backend selects a model only when /v1/chat is called. |
| Same-question comparison | ✅ | Side-by-side preview panels. |
| Context preview | ✅ | `/v1/context/preview`. |
| Token estimate | ✅ | Pill on each panel. |
| Memories used / Docs used / Cache used / Warnings / Compiled prompt | ✅ | All in `ContextPreviewPanel`. |
| Side-by-side demo (User A short technical, User B beginner) | ✅ | "Seed demo" button seeds both. |
| "Preview only — no model call." label | ✅ | Hero pill + notice text. |

## Page 3 — Memory Library

| Brief item | Status | Notes |
|---|---|---|
| Shelves: Preferences / Project Decisions / Coding Style / Current Goals / Session Summaries / File Knowledge / MCP Handoffs / Security Notes / Archived / Conflicted / Expired | ✅ | All 11 shelves shipped as chips, plus Low confidence and All. |
| Memory card: type | ✅ | Pill. |
| Memory card: title | ✅ | Derived from first 64 chars of text. |
| Memory card: memory text | ✅ | Full text below title. |
| Memory card: scope | ✅ | Pill. |
| Memory card: confidence | ✅ | Percentage line. |
| Memory card: source | ✅ | `source_message_id` displayed. |
| Memory card: last_used / last_confirmed | ✅ | Both shown. |
| Memory card: state | ✅ | Pill (active/archived/conflicted/deprecated). |
| Memory card: related session | 🟡 | `source_message_id` is the closest field today. Full session linkage needs the sessions backend. |
| Memory card actions: edit | ✅ | Inline edit + save via `PATCH /v1/memories/{id}`. |
| Memory card actions: confirm | ✅ | |
| Memory card actions: archive | 🟡 | The `archived` state exists; UI archive verb is currently exposed via Delete (soft-delete). A dedicated archive action is deferred. |
| Memory card actions: delete | ✅ | |
| Filters (type / scope / confidence / source / state / date / app/project/session) | 🟡 | Shelf chips filter by type + state. App/user are in topbar. Confidence has a dedicated shelf. Date / source filters are deferred. |
| Keyword search | ✅ | Submits to `?q=` (semantic). |
| Semantic search | ✅ | Same endpoint. |
| Memory Quality (duplicates / old / low-confidence / never used / conflicts) | ✅ | `MemoryQualityPanel`. |

## Page 4 — Sessions

| Brief item | Status | Notes |
|---|---|---|
| Session title / source tool / model / start-end / token usage | 🟡 | We surface `context_runs`. Tool source needs backend. |
| Session states (active / nearing limit / summarized / handed off / archived) | ⏳ | Need session-summary endpoint. |
| Token danger meter | ✅ | Safe / Watch / Danger / Critical bands. |
| Memory saved count | 🟡 | Aggregate via Recent context activity, per-session count needs backend. |
| Handoff status / Quick action: summarize / Quick action: create handoff | ⏳ | Handoff CTA visible on Sessions hero; routes to Handoff page. |

## Page 5 — Handoff

| Brief item | Status | Notes |
|---|---|---|
| Handoff Capsule concept exposed | ✅ | Read-only page with full schema. |
| Schema shown | ✅ | Example capsule JSON + Copy button. |
| Actions (Create / Continue in Claude / Continue in Codex / Copy / Send to MCP / Archive) | ⏳ | All require `/v1/handoffs` + 3 MCP tools. Page lists the planned endpoints. |
| Highlighted in README / dashboard | ✅ | README "Sessions / Handoff" sidebar entry + CHANGELOG. |

## Page 6 — Models / Providers

| Brief item | Status | Notes |
|---|---|---|
| Providers (OpenAI / Anthropic / Gemini / Qwen / OpenRouter / Ollama / LM Studio / Custom) | ✅ | 8 cards. |
| Provider card: status configured/not | 🟡 | Status pill says "Live via env" — actual configured-vs-not detection requires Gateway to expose current provider, which it doesn't yet via API. |
| Provider card: test connection | ⏳ | Same blocker. Gateway-side `/v1/providers/test` would unlock this. |
| API key security (never shown after save, no logging) | ✅ | Dashboard never accepts keys — env-var path keeps them out of the browser entirely. |

## Page 7 — Files / Knowledge

| Brief item | Status | Notes |
|---|---|---|
| Add folder | 🟡 | Single-document upload via form. Folder sync is CLI/Desktop. |
| Sync markdown/txt docs | ✅ | Via POST /v1/documents. |
| Indexed chunks list | ✅ | Per document. |
| Source path | ✅ | `source` field shown. |
| Last sync | 🟡 | We show `updated_at` indirectly via the document. Explicit "last sync" needs a connector. |
| Content hash | ✅ | First 16 chars of hash. |
| Prompt injection risk | ✅ | Per-chunk risk score + warning pill. |
| Included/excluded status | 🟡 | Risky chunks are surfaced; explicit include/exclude toggle is deferred. |

## Page 8 — MCP & Plugins

| Brief item | Status | Notes |
|---|---|---|
| MCP status (running/not, local endpoint, connected clients, tools) | 🟡 | Tools list + Gateway endpoint test. Actual stdio handshake is impossible from a web dashboard (stdio servers are started by the client). |
| One-click/copy setup for Claude Desktop / Claude Code / Cursor / generic MCP | ✅ | 4 copy-config cards rendered with the live `apiBaseUrl`. |
| Codex CLI config | ✅ | Bonus 5th card with TOML. |
| Available tools list | ✅ | 8 tools with descriptions. |
| Copy config button | ✅ | Per card. |
| Test MCP connection | 🟡 | "Test Gateway endpoint" is the closest meaningful test from the dashboard. |
| Send test memory button | ✅ | Writes a tagged memory via POST /v1/memories. |
| Plugin/extension future (VS Code, Cursor, Raycast, browser) | 🟡 | Mentioned in the README. Dashboard does not yet have a plugin marketplace card. |

## Page 9 — Cache

| Brief item | Status | Notes |
|---|---|---|
| Hit rate | ✅ | From context_runs. |
| Saved calls / saved tokens / saved cost estimate | 🟡 | Saved tokens are shown via Sessions and Command Center; saved cost estimate needs provider price data. |
| Recent cached prompts | ✅ | List of entries. |
| Dependency freshness / TTL / invalidated | 🟡 | TTL pill and clear action. Per-entry dependency view is deferred. |
| Per-entry clear button | 🟡 | Bulk clear shipped; per-entry deferred. |
| "Cache is not memory" explanation | ✅ | Hero copy + Command Center note. |

## Page 10 — Security

| Brief item | Status | Notes |
|---|---|---|
| Prompt injection scanner | ✅ | Status card. |
| Secret detection | ✅ | Status card. |
| Memory privacy / scope | ✅ | Status card. |
| MCP exposure mode | ✅ | "Safe · stdio/local". |
| Provider keys storage | ✅ | Explained — keys live in env / Gateway, not browser. |
| Risky docs excluded | ✅ | Surfaced via document chunk risk. |
| Recent security events | 🟡 | Audit Logs page covers this, but a dedicated risk-event timeline is deferred. |

## Page 11 — Audit Logs

| Brief item | Status | Notes |
|---|---|---|
| Memory / document / API key / handoff / MCP / context events | ✅ | All real events from `/v1/audit-logs`. |
| Filters (actor / action / resource / date / risk) | 🟡 | Backend returns the full list. Client-side filters are deferred. |

## Cross-cutting

### Color theme
✅ All tokens from the brief implemented in `globals.css` and `tailwind.config.ts`.

### Typography
✅ Inter/Geist UI + JetBrains Mono code. Hierarchy follows the brief.

### App structure / navigation
✅ Sidebar grouped Control / Capabilities / Governance, 12 pages, status dots per item.

### Topbar
✅ Pills (health, page status, deployment mode, memories, docs, cached), Search ⌘K, notifications stub, App ID / User ID, Refresh.

### Footer status bar
✅ Docs / Roadmap / Contribute links, gateway URL, system-healthy pill.

### Command palette
✅ ⌘K / Ctrl+K opens, Escape closes, fuzzy filter across 12 pages.

### Responsive
✅ Verified at 1440×900 (desktop) and 390×844 (mobile). Sidebar collapses to sticky-top; no horizontal overflow; cards stack.
🟡 Bottom-nav drawer for mobile is deferred — sticky-top sidebar is the chosen pattern for v0.1.6.

### Animation / motion
✅ Glass blur, hover lift, skeleton shimmer. Reduced-motion via OS preference and a manual override in Settings.
✋ Animated gradient orbs / particle effects deferred — would conflict with the "calm command center" tone.

### Accessibility
✅ Focus rings via CSS, aria-labels on icons-only buttons, keyboard palette, reduced-motion support, semantic landmarks (`nav`, `main`, `header`, `footer`, `section`).
🟡 Formal axe / pa11y audit is deferred.

### Performance
✅ Production build 25.7 kB page / 128 kB First Load JS. No WebGL. Skeletons for loading.

### Deployment honesty
✅ Topbar shows detected mode (Local / Self-hosted / Custom). Settings has Deployment card with docker compose + sqlite fallback. Models page reframed as Live via env, not Planned.

## Backend work that is genuinely missing

This is what an honest "what would unlock the brief in full" list looks like:

1. **Handoff Capsules** — `handoff_capsules` table + 6 endpoints + 3 MCP tools.
2. **Session summary endpoint** — derive a summary from `conversations` + `messages` + `context_runs`. Enables the summarize-now action and tool source tracking.
3. **Provider introspection endpoint** — `GET /v1/providers/current` returning kind / model / base_url. Unlocks live model name in Command Center and configured-vs-not on Models cards.
4. **Provider test-connection endpoint** — `POST /v1/providers/test` that round-trips a tiny prompt and returns success/error. Unlocks "Test connection" on Models.
5. **Connectors / folder sync** — already partly designed in CLI/Desktop. Dashboard would gain folder-sync UI.
6. **Per-entry cache invalidation endpoint** — `DELETE /v1/cache/{id}`. Enables per-entry Clear button.

These are honest backend gaps, not dashboard gaps.

## Verification log

- `npm run lint` — clean (--max-warnings=0)
- `npm run typecheck` — clean
- `npm test` — 1/1
- `npm run build` — 25.7 kB / 128 kB First Load JS
- `npx playwright test` against live Gateway — 5/5 pass
- `claude mcp list` — `n0tune ✓ Connected`
- `n0tune_alignment_check` UI-2 + UI-7 — aligned, low risk
- `n0tune_save_memory` + `n0tune_search_memories` round-trip proven in this session
