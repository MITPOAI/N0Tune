# Changelog

## Unreleased

- Reframed N0Tune around cross-tool project context: "Keep context across
  Claude, Codex, Cursor, and every AI tool."
- Added project detection, project tools, sessions, and Handoff Capsule
  models plus migration `20260524_0005_project_context`.
- Added project-context API routes for detect, context, project memory,
  sessions, handoffs, continuation prompts, and archive.
- Added CLI commands for `project`, `session`, `handoff`, project memory, and
  project context preview.
- Added MCP project-context and handoff tools.
- Updated dashboard Command Center, Sessions, Handoff Capsules, and MCP pages
  to reflect live project context.
- Added cross-tool project context, handoff, MCP, CLI, dashboard, and
  dogfooding docs.

All notable changes to N0Tune will be documented here.

## 0.1.7 - 2026-05-23

Codex follow-up on the v0.1.6 dashboard handoff.

### Added

- Mobile dashboard bottom navigation with a compact drawer below 768 px.
  Primary destinations stay one tap away and the full sidebar opens as a
  bottom sheet with 44 px+ touch targets.
- Desktop Tauri release check against
  `https://api.github.com/repos/MITPOAI/N0Tune/releases/latest`. The Rust
  side compares the latest GitHub release tag with the bundled Cargo
  version and emits `n0tune://update-available`; the renderer surfaces a
  footer update link without auto-downloading anything.
- AppShell render error boundary plus visible fetch error states for
  dashboard refreshes and action-specific Gateway calls.

### Changed

- Command Center concept-detail polish: companion mascot bubble now uses
  a soft glow without an inner border, inner stat tiles stay transparent
  with a 1 px line, health/arc strokes are slimmer, pressure bars are 6 px,
  and chips use soft fills without visible borders.
- Direct `Concept.png` follow-up: the Companion card now uses the
  concept's desktop horizontal mascot/text composition while stacking on
  mobile, and the Command Center waits for wider desktop space before
  forcing three-column card rows.
- Memoized Command Center derived state (`companionMood`,
  `contextHealthBreakdown`, and `aggregateRuns`) so those calculations do
  not rerun on unrelated renders. `memoryQuality` remains memoized in the
  Memory Library.

### Fixed

- Dashboard refresh errors are de-duplicated by request scope, so repeated
  failed syncs no longer stack the same visible error state.

## 0.1.6 - 2026-05-23

A dashboard redesign pass. UI-0 (audit) and UI-1 (design system + AppShell +
Command Center) already shipped in v0.1.5; this release completes UI-2
through UI-7 across all twelve pages without faking any backend feature.

### Added

- **Command palette (⌘K)** in the topbar with fuzzy filtering across all 12
  pages. Includes a stubbed notifications button labelled planned.
- **Footer status bar** with docs/roadmap/contribute links, gateway origin,
  and a live `system healthy` pill driven by `/health`.
- **Sidebar version + GitHub footer** anchored at the bottom of the
  navigation column.
- **Adaptive companion mood** on Command Center — Ready / Learning /
  Watching / Needs setup / Checking — derived from real Gateway state and
  the latest context preview, not a hardcoded "Ready".
- **Memory Library shelves as first-class filters.** Eight chips
  (All / Preferences / Project decisions / Coding style / Current goals /
  Archived / Expired / Low confidence) drive the visible list.
- **Semantic memory search** wired to `GET /v1/memories?q=` with a clear-
  search action.
- **Memory Quality panel** — counts low-confidence, never-confirmed,
  expiring-soon (< 7 days), and duplicate-text memories.
- **Sessions token danger meter** — Safe / Watch / Danger / Critical bands
  computed from peak compiled tokens across context runs. Honest 8k
  reference budget; not a fake provider limit.
- **Per-run detail panel** on Sessions — selected memories, chunks, and
  style snapshot for any context_run row.
- **Aggregate session stats** — total tokens, average per run, tokens
  saved, cache hit rate.
- **Handoff Capsules planned page** — full example capsule JSON with copy
  button, planned endpoint list, planned MCP tool list, and a section
  explaining what ships when `/v1/handoffs` lands.
- **MCP & Plugins copy-config blocks** for Claude Desktop,
  Claude Code (one-liner), Cursor, and Codex CLI — every block uses the
  dashboard's current `apiBaseUrl`, `appId`, and `userId` so the snippet
  works after restart.
- **MCP gateway test button** that hits `/health` and reports whether the
  Gateway the MCP server reads from is reachable.
- **Provider cards on Models** with wire shape, routing role, privacy
  note, and the real `N0TUNE_PROVIDER_*` env vars each provider needs
  today. The dashboard-key UI stays clearly Planned.
- **Settings page** with workspace identity, theme switch (data-theme
  attribute), reduced-motion toggle (data-motion override), demo-data
  label switch, memory export (`GET /v1/memories/export` → downloadable
  JSON), and developer/about cards.
- **Deployment-mode detection** in the topbar — green "Local" pill when
  the Gateway is on `localhost` / `127.0.0.1` / private IP / `.local`,
  blue "Self-hosted" when it's an internal hostname, neutral "Custom
  endpoint" otherwise.
- **Deployment card on Settings** showing the detected mode plus the
  `docker compose up -d --wait` and SQLite-fallback commands as copy
  blocks, both with a one-click copy button. Explicit "open source under
  MIT, zero telemetry, memories stay on the Gateway you control" line.
- **Global ⌘K / Ctrl+K keyboard shortcut** opens the command palette;
  Escape closes it.

### Second-pass additions (companion + missing shelves + memory edits)

- **Companion identity** — give your N0Tune companion a name (default
  `N0va`) and import a custom avatar (PNG/JPG/SVG/WebP ≤ 1 MB). Stored
  in `localStorage` only (`n0tune.companion.name`,
  `n0tune.companion.avatar`); nothing is uploaded to the Gateway. Settings
  → Companion has the form; Command Center renders the chosen name and
  avatar in the hero card.
- **Companion gamification badges** on the Command Center hero — derived
  from real state, not childish. "No secrets stored", "First memory · N",
  "Knowledge indexed · N", "Active runtime", "Cache warming".
- **All 11 shelves from the original brief** — added Session Summaries
  (type=summary), File Knowledge (type=file), MCP Handoffs (type=handoff),
  Security Notes (type=security), and Conflicted (state=conflicted /
  state=deprecated / has `replaced_by_memory_id`). Plus All and Low
  confidence carry over, making 13 chips total.
- **Memory edit action** — inline textarea + Save/Cancel hits
  `PATCH /v1/memories/{id}`. Memory card now also shows a derived label
  (`type · date`) and `source: source_message_id`. The brief's "related
  session" remains mapped to `source_message_id` until the sessions
  backend ships a richer link.
- **MCP "Send test memory" button** — POSTs a tagged memory directly to
  `/v1/memories` so you can verify the dashboard ↔ Gateway round-trip
  without a separate curl. Next: search for the memory via
  `n0tune_search_memories` from Claude/Cursor to close the loop.

### Bug fixed: e2e regression from useEffect overwriting input fills

The user_id and app_id initialisation moved from a post-mount useEffect to
a `useState` lazy initializer that reads localStorage during the very
first render. The previous shape allowed Playwright's `fill()` to race
against the useEffect, occasionally restoring a stale `localStorage`
value over the test's typed value. Full e2e now runs 5/5 in 18.5 s
(down from 41.7 s — fewer redundant refetches as well).

### Honesty pass on "Live vs Planned"

N0Tune is open source and the user owns the deployment (`docker compose`
or SQLite fallback). Some "Planned" labels from the first cut conflated
*capability missing* with *dashboard-form missing* — fixed now:

- **Models page** is now `Live · env config` with a secondary
  `In-dashboard key form planned` badge. The provider router supports
  openai-compatible, anthropic, and gemini wire shapes today — set
  `N0TUNE_PROVIDER_*` env vars before `docker compose up`. Each provider
  card has a Copy button for its env vars.
- Models nav status flipped from `planned` → `live`.

Still genuinely Planned (needs backend code, not just a form):

- `handoff_capsules` table + `/v1/handoffs` endpoints + 3 MCP tools.
- Full session-summary endpoint + summarize-now action.
- Live MCP handshake from the dashboard (stdio servers boot when their
  client launches them).

### Changed

- The four "planned" pages (Sessions, Handoff, Models, Settings) now own
  their hero card and content; the temporary `PlannedShell` wrapper was
  removed because it forced the same uninformative layout on every
  planned page.
- Topbar now shows live memory / docs / cache counts as quick context
  pills alongside health/status.
- Dashboard CSS gained `.danger-meter`, `.copy-block`, `.chip`, and
  `.palette-*` primitives; the sidebar is now a flex column so the
  GitHub + version footer can pin to the bottom.
- `data-motion="reduced"` on `:root` now mirrors the existing
  `prefers-reduced-motion` media query so the Settings toggle can
  override the OS preference.

### Verified

- `npm run lint` clean (0 warnings, eslint --max-warnings=0).
- `npm run typecheck` clean.
- `npm test` (vitest) — 1/1 passes.
- `npm run build` — production bundle 24.8 kB page / 127 kB First Load JS.
- `next dev` boots in ~1.6 s on port 3001.
- Dogfooded via `mcp__n0tune__n0tune_alignment_check` (phase UI-2): aligned,
  risk_level=low, no issues. Persona shell read via `n0tune_get_persona`.
- E2E selector audit: all Playwright dashboard.spec.ts selectors
  (Refresh, App ID, User ID, Memory Library/Files/Command Center/Context
  Lab/Cache nav buttons, Save memory, Update style profile, Index document,
  Compile context, Selected docs/memories, Trace: selected, Seed demo,
  Clear cache, Cache is empty) preserved.

### What is real today vs planned

| Surface          | Status   | Reality                                                                             |
| ---------------- | -------- | ----------------------------------------------------------------------------------- |
| Command Center   | Live     | Health, memory/doc/cache stats, context preview, recent runs, adaptive companion    |
| Context Lab      | Live     | Two-user `/v1/context/preview` comparison, no fake LLM answer                       |
| Memory Library   | Live     | CRUD + shelves + semantic search via `?q=` + quality heuristics                     |
| Sessions         | Partial  | Built on context_runs; full session summary endpoint planned                        |
| Handoff          | Planned  | Read-only — `/v1/handoffs` and three MCP tools not yet implemented                  |
| Models           | Planned  | Env-var config today; dashboard key UI planned                                      |
| Files            | Live     | Index + list documents and chunks; chunk-level injection-risk shown                 |
| MCP & Plugins    | Partial  | Stdio MCP server ships; copy-config blocks live; in-dashboard handshake planned     |
| Cache            | Live     | Semantic cache list / clear; hit rate from context_runs                             |
| Security         | Live     | Live secret + injection + scope status; provider-key UI still planned               |
| Audit Logs       | Live     | Owner/admin API key required                                                        |
| Settings         | Live     | Workspace, theme, motion, demo labels, memory export, developer info                |

## 0.1.5 - 2026-05-18

A "make it useful, not just another context compressor" release. Full
notes in [docs/releases/v0.1.5.md](docs/releases/v0.1.5.md).

### Added

- **Live trace tab** in the dashboard. One request, drawn end-to-end —
  retrieval-score bars per memory, MMR drops with citations, token
  math (compiled vs naive vs saved%), cache check, pipeline strip.
  Uses the existing `/v1/context/preview` endpoint.
- **Adaptive persona** — `POST /v1/users/{user_id}/style/adapt`.
  Walks the last 20 preference/fact memories and proposes
  tone/depth/format flips when ≥ 40 % of them agree on one label.
  No LLM. 4 unit tests cover empty / agreement / already-match /
  weak-majority paths.
- **SavingsHero** on Desktop Home: three tabular-numeric cards
  (saved this session, vs naive baseline %, average per request).
  Hidden until the user has actually chatted.
- **Dogfood evidence log** at `docs/dogfood-evidence.md`. Six
  memories from the v0.1.5 work session written and queried back
  from the running Gateway, with the verification curl commands so
  any reader can reproduce the proof.
- **Rate-limit headers** on every `/v1/` response: `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `X-RateLimit-Reset`. 429 also sets
  `Retry-After`. The `hit()` contract now returns a typed
  `RateLimitDecision`.
- **Compiler unit tests** — `apps/api/app/tests/test_compiler_internals.py`
  with 7 tests covering MMR diversity edge cases.

### Changed

- **Palette unified.** Desktop palette (beige + navy + warn) wins;
  dashboard adopts the same CSS-variable design tokens and now has a
  real `prefers-color-scheme: dark` block. Tailwind theme reads from
  the CSS vars so dark mode flips both apps in one place.
- **Desktop dark-mode line contrast** bumped from `#2e2a25` (1.6:1
  vs surface — failed WCAG) to `#3d3930` so cards read clearly. Dark
  shadow strengthened slightly to match.
- **Rate-limit backend contract** — `hit()` now returns a
  `RateLimitDecision` dataclass with `allowed / remaining /
retry_after / reset_at` instead of a `(bool, int)` tuple. Backwards-
  incompatible only for code that imported the internal API.

### Smoke at tag time

- 66 API tests pass; ruff clean; mypy reports only the 3 pre-existing
  external-library stub errors (pgvector / langfuse / fastembed).
- Desktop: 7/7 tests, lint + typecheck green, production bundle still
  in the ~240 kB band.
- Dashboard: lint + typecheck green.
- `claude mcp list` continues to report `n0tune: ✓ Connected`.

## 0.1.4 - 2026-05-17

A wire-fix release. v0.1.3 claimed MCP was wired; on a real Claude
Code 2.0.76 machine it was actually `✗ Failed to connect`. v0.1.4
diagnosed and fixed it. Full notes in
[docs/releases/v0.1.4.md](docs/releases/v0.1.4.md).

### Fixed

- **MCP server now handles `notifications/initialized` correctly.**
  Claude Code's MCP handshake sends a JSON-RPC notification right after
  `initialize`. Our server's early-return on missing `id` was correct
  in spirit but left Claude Code's client waiting for an ack that never
  came, timing out the connection. Now explicit: notifications get
  logged (under `N0TUNE_MCP_DEBUG=1`) and acknowledged silently.
- **`scripts/sync-mcp-config.mjs` writes `.mcp.json` at the project
  root** — that's where Claude Code 2.x reads. The previous version
  wrote `.claude/mcp.json` (Claude Code 1.x) which is now ignored.
  The new sync also tears down the stale `.claude/mcp.json` files left
  by earlier syncs so there's only one source of truth.

### Added

- **Diagnostic log** at `$TMPDIR/n0tune-mcp-server.log` when
  `N0TUNE_MCP_DEBUG=1` is set. Captures startup args, cwd, notifications,
  handler errors — first port of call when an MCP launch fails.
- **Robust entry-point check** via `path.normalize` + `fs.realpathSync`
  with case-insensitive comparison. Survives Windows path encoding
  (spaces → `%20`), case differences, and Claude Code's spawn wrapper.

### Verified

- `claude mcp list` reports `n0tune: ✓ Connected` (first green).
- Manual JSON-RPC smoke: 8 tools, `initialize` → `notifications/initialized`
  → `tools/list` → `tools/call` all round-trip.

## 0.1.3 - 2026-05-17

A "make it smart and wire it" release. v0.1.2 made N0Tune downloadable;
v0.1.3 makes it **actually work** in a live Claude Code session and adds
a real alignment layer. Full notes in
[docs/releases/v0.1.3.md](docs/releases/v0.1.3.md).

### Smarter retrieval

- State weighting in `effective_confidence`: confirmed → 1.10×, active
  → 1.0×, candidate → 0.80× (clamped). Confirmed memories now rank
  above unaffirmed ones with the same base confidence.
- Type-aware decay half-life: preferences 180d, facts 90d, project
  state 30d. Was a flat 60d.
- MMR diversity pass in the context compiler. Drops near-duplicates
  (cosine ≥ 0.92) before the token-budget step; surfaces the drops in
  the trace as `near-duplicate of mem_<id>`.

### Context Guard CG-1 + CG-2 + CG-5 minimal

- `alignment_rules` table + alembic migration (`20260519_0004`).
- Rule engine in `apps/api/app/services/alignment/rules.py`. Six rule
  types + always-on secret detector. Pure deterministic. 18 unit tests.
- API: `POST /v1/alignment/check`, `GET /v1/alignment/rules`,
  `POST /v1/alignment/rules` (admin-only). 5 integration tests.
- MCP: `n0tune_alignment_check` is now the 8th tool on the server.
- Seed script: `scripts/seed-alignment-rules.py` (idempotent, 7 rules).

### Wiring fix for Claude Code worktrees

`scripts/sync-mcp-config.mjs` now rewrites relative args to absolute
paths when the target worktree is a sparse copy missing the referenced
files. Fixes the case where Claude Code launched from a worktree could
not actually spawn the MCP server.

[`docs/wire-to-claude.md`](docs/wire-to-claude.md) gets a one-screen
restart procedure walking through Gateway boot → sync → restart →
verify with `/mcp`.

## Unreleased

### Added — Context Guard (Phase CG-0, design only)

- New design docs for **Context Guard**, the planned alignment + grounding
  layer that checks whether an AI agent's response, plan, or diff stays
  aligned with N0Tune's stored direction, current phase, security rules,
  and benchmark facts:
  - [docs/context-guard.md](docs/context-guard.md) — user-facing pitch,
    the ten alignment questions, agent workflow, planned surfaces
    (API / dashboard / CLI / MCP), CG-0 through CG-6 phase plan.
  - [docs/alignment-checker.md](docs/alignment-checker.md) — technical
    contract: engine layers (rule_engine, retrieval_check, llm_judge),
    `AlignmentReport` schema, `alignment_rules` table design, planned
    API surface, CLI design, MCP tool design.
  - [docs/dogfooding-alignment.md](docs/dogfooding-alignment.md) — the
    eight fixtures CG-6 will run against N0Tune's own history,
    pass/fail criteria, expected false-positive failures + how to
    resolve them.
- README gets a "Context Guard (design phase)" section above "How It
  Works" so users encounter the framing before the deep dives.
- `docs/roadmap.md` gains a Phase CG block (CG-0 through CG-6) with
  acceptance criteria per sub-phase.
- `docs/architecture.md` gains a Context Guard component sketch
  showing how the engine sits next to the Context Compiler.
- `docs/testing.md` documents the planned 14-item Context Guard test
  matrix, mapped to the CG sub-phases.

CG-0 is **design only.** No engine code, no endpoint, no UI, no CLI, no
MCP tool, no rules data, no new dependencies, no schema migration. The
semantic cache, context compiler, provider router, and memory
consolidation are untouched.

### Dashboard

- Sidebar nav replacing the nine-tab single-row strip. Tabs are grouped
  into Start / Personalize / Run / Observe with a one-line hint under
  each; the hint is `aria-hidden` so accessibility-name selectors (and
  the Playwright e2e suite) keep working unchanged.
- Header tagline corrected to the current headline ("Fine-tune any AI,
  without fine-tuning") since v0.1.2 already shipped the framing change
  in the docs but the dashboard chrome had not been updated.

## 0.1.2 - 2026-05-17

A framing + dynamics release. Same product surface as 0.1.1; what
changes is the **headline** (back to context-tuning), the
**continual-learning loop** (now dynamic), and the **download path**
(cross-platform release workflow). Full notes in
[docs/releases/v0.1.2.md](docs/releases/v0.1.2.md).

### Framing

- **Headline reframe.** v0.1.1's "armor for your AI tools" understated
  what the system actually delivers. Restored "Fine-tune any AI.
  Without fine-tuning." as the headline across README,
  product-direction, overview, editions, how-it-works, install,
  CLAUDE.md, AGENTS.md, Tauri bundle metadata, and the dogfooding seed
  memories. Both the standalone Desktop and the integration layer (MCP
  / OpenAI proxy / SDKs) are framed as first-class surfaces.

### Dynamic consolidation

- **Auto-trigger** on `POST /v1/chat`, `POST /v1/openai/chat/completions`,
  and `POST /v1/memories` via FastAPI `BackgroundTasks`. The trigger
  short-circuits cheaply when the user has fewer than 12 active memories
  or the last summary is younger than the 15-minute cooldown; otherwise
  it runs the full clustering pass.
- Trigger conditions live in
  `app.services.memory.consolidation.should_auto_consolidate`. The
  background runner is `maybe_consolidate(session_factory, app_id, user_id)`.
- Consolidation **does not call any provider** by default — the summary
  is a deterministic concatenation of the cluster members. The
  provider-backed summary remains opt-in via `summarize=True` on the
  explicit endpoint, using the same provider you configured for chat.
- End-to-end smoke against the live stack: 13 similar memories →
  background pass fires after the 13th write → 1 summary + 2 deprecated,
  zero LLM tokens spent.

### Release workflow

- New `.github/workflows/release.yml` builds the Tauri bundle on
  windows-latest, macos-14 (arm64), macos-13 (x64), and ubuntu-22.04 on
  every `v*` tag push, then uploads every `.exe / .msi / .dmg /
.AppImage / .deb` to the matching GitHub Release. v0.1.2 is the first
  release where pre-built installers are downloadable.

## 0.1.1 - 2026-05-17

Polish release. Same product surface as 0.1.0, but CI is green, agents
get a one-page operating manual, and the install story is documented.
Full notes in [docs/releases/v0.1.1.md](docs/releases/v0.1.1.md).

### CI

- Gitleaks no longer trips on the literal `X-N0Tune-API-Key` header name
  in CHANGELOG prose. `.gitleaks.toml` gets `regexTarget = "line"`,
  a `CHANGELOG.md` path entry, the header regex, and the project
  stopwords; `.gitleaksignore` pins the historical fingerprint.
- `integrations/vercel-ai-sdk` and `apps/desktop` typecheck clean.
  `packages/sdk-js` got a `prepare` script (npm install builds `dist/`)
  and the Node CI job builds `@n0tune/sdk` before any workspace
  typechecks run.
- Playwright e2e — removed a stale `aria-label="Refresh data"` that
  shadowed the "Refresh" button text and broke the anchored test
  regex. CI now also polls `localhost:3000` before starting tests
  (the dashboard container has no healthcheck).

### Agents

- `CLAUDE.md` + `AGENTS.md` at the repo root. Armor framing, hard
  rules, repo map, conventions, pre-PR commands. Future agents stay
  grounded.

### Install

- `docs/install.md` — standalone install guide with a paste-able
  prompt that has the AI itself wire up MCP for you.

### UI

- Desktop styles: light/dark via prefers-color-scheme, refined palette,
  focus rings, subtle motion, tabular numerals on the status overlay.
- Dashboard styles + Tailwind config: matched transitions, surface
  shadows, hover/active states, and the header tag reframed from
  "Personal AI Runtime" to "Armor for your AI tools".

### Tauri

- Removed every iOS/Android `cfg` gate from `apps/desktop/src-tauri`.
  The project targets Windows/macOS/Linux only.

### Dogfooding

- `scripts/seed-dogfooding.ps1` now indexes the armor docs alongside
  `context-compiler.md` and posts armor-framed seed memories. Three
  context previews fire end-to-end to confirm the compiler returns
  the right framing.

## 0.1.0 - 2026-05-17

First tagged release. The "armor for your AI tools" framing replaces the
earlier "Personal AI Runtime" pitch — the Desktop chat is now a fallback
and the headline integrations are MCP (Claude / Cursor / Codex CLI) +
the OpenAI-compatible Gateway proxy + the tray-hotkey path for any other
tool. Full release notes in [docs/releases/v0.1.0.md](docs/releases/v0.1.0.md).

### Highlights

- Reframe: README + product-direction + how-it-works + editions
  restructured around "armor not warrior." `docs/wire-to-codex-cli.md`
  and `docs/wire-to-gemini-cli.md` ship as first-class integration
  docs.
- New `n0tune compile <message>` CLI subcommand for tools (Gemini CLI,
  vim, anything) that accept a system prompt as text/file.
- `scripts/gen-icons.py` regenerates icons + favicons from
  `img/logo-s2.png`.
- Desktop tray icon + global hotkey (`Cmd+Shift+Space` mac,
  `Alt+Space` elsewhere). Quick-remember overlay + status overlay.
  Window close hides to tray instead of quitting.
- Rust-side SQLite (`apps/desktop/src-tauri/src/storage.rs`) + OS
  keychain (`secrets.rs`). Desktop installer is now self-contained;
  the renderer `TauriBackend` routes memory + provider keys through
  the Rust runtime.
- Continual-learning loop: `POST /v1/memories/consolidate` clusters
  similar memories and collapses them into a denser summary. New
  `n0tune memory consolidate [--dry-run]` CLI subcommand.

### Smoke at tag time

- 93 Python tests, 6 Node workspaces typecheck + test green.
- `mypy --strict`, `ruff`, `eslint --max-warnings=0` clean.
- `python -m evals token_savings` reproduces 17.4 %.

## Unreleased

### Added

- Dashboard UI-0/UI-1 redesign:
  - Added `docs/ui-redesign.md` with the dashboard audit, backend feature audit, page map, design tokens, component system, responsive rules, effect rules, Handoff Capsule backend proposal, and phased UI plan.
  - Replaced the old dashboard shell with a liquid-glass AppShell, grouped navigation, live/partial/planned status labels, and a redesigned Command Center.
  - Added reusable dashboard primitives: `GlassCard`, `StatCard`, `StatusPill`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `SectionHeader`, and `TokenSavingsMeter`.
  - Kept live Gateway-backed flows for Context Lab, memory, style, documents, cache, security, and audit logs while clearly labeling Sessions, Handoff, Models, and Settings as planned.
- Phase B Core extraction:
  - Added installable Python package `packages/core` as `n0tune-core`.
  - Core now owns shared token estimation, stable hashing, deterministic hash embeddings, cosine similarity, BM25 lexical scoring, prompt-injection scanning, secret detection, context rendering, naive-token baseline estimation, hybrid score blending, and Protocol interface contracts.
  - Gateway now imports Core for shared context-tuning primitives while keeping FastAPI, SQLAlchemy persistence, provider HTTP calls, and cache dependency checks in `apps/api`.
  - Added Core unit tests and wired Core into CI, Docker build context, testing docs, and the local `check-mvp.ps1` validation script.
- Dashboard Context Lab:
  - Added a no-fake-output product demo that creates or selects two users, seeds different style memories, calls `/v1/context/preview` for both, and compares selected memories, selected document chunks, compiled context, token estimates, token savings, warnings, and context trace side by side.
  - Added memory deletion, context trace rendering, selected memory/document panels, warning surfacing, and an audit-log tab for owner/admin inspection.
- Phase A product reframe:
  - README now positions N0Tune as an open-source Personal AI Runtime: "N0Tune turns any AI model into your personal AI - without fine-tuning."
  - Added `docs/product-direction.md`, `docs/desktop-architecture.md`, `docs/editions.md`, and `docs/context-tuning.md`.
  - Reframed the existing FastAPI server/API work as N0Tune Gateway while preserving the current implementation path.
  - Updated `docs/overview.md` and `docs/architecture.md` so older docs match the Desktop/Core/CLI/MCP/Gateway product shape.
  - Updated `docs/roadmap.md` with the Desktop/Core/CLI/MCP/Gateway roadmap.
  - Updated `docs/dogfooding.md` to explain how the current Gateway dogfooding loop supports future Desktop/Core work.
  - Added architecture placeholders for `apps/desktop`, `packages/core`, `packages/cli`, `personas`, and `examples/desktop-personal-ai`.

- Phase 11 — Permissions + audit log:
  - Four roles (`viewer`, `developer`, `admin`, `owner`) with a permission matrix in `services/security/permissions.py`.
  - New `api_keys` table and `POST/GET/DELETE /v1/api-keys` for minting, listing, and revoking app keys. Plaintext is returned once; only the hash is stored.
  - New `audit_logs` table and `GET /v1/audit-logs` (admin-only). Memory and document mutations + API key changes now write audit rows.
  - Legacy `N0TUNE_APP_API_KEY` remains valid as an `owner` role for backward compatibility.
  - 11 new tests in `apps/api/app/tests/test_permissions_and_audit.py`.
  - `docs/permissions.md` and `docs/audit-logs.md`.
- Phase 9 — Memory lifecycle:
  - New columns on `memories`: `state`, `last_used_at`, `last_confirmed_at`, `version`, `replaced_by_memory_id`.
  - `services/memory/lifecycle.py`: state set, retrievable filter, exponential decay anchored at `last_confirmed_at` / `last_used_at` / `updated_at`, `confirm`/`deprecate` helpers.
  - `POST /v1/memories/{id}/confirm` pins confidence past the half-life.
  - `GET /v1/memories/export` returns soft-deleted rows for privacy compliance.
  - Compiler now stamps `last_used_at` on selected memories without invalidating the semantic cache (regression fixed by removing `onupdate=now_utc` from `memories.updated_at`).
  - `docs/memory-lifecycle.md`.
- Phase 10 — Memory scopes:
  - New `scope` column on `memories` (`global`, `app`, `org`, `team`, `project`, `user`, `session`).
  - Compiler retrieves user-scoped memories plus shared-scope memories from the same app; cross-user `user`-scoped memories stay private.
  - `docs/memory-scopes.md`.
  - 9 new tests covering the lifecycle and scope behaviors.
- Phase 8 — Evaluation harness:
  - `evals/` directory with a shared `harness.py` and a `python -m evals` runner.
  - `evals/token_savings_eval/` is the first real eval (scenarios JSON + a runnable script). The honest "stuff everything in" baseline is computed locally rather than trusted from the API. Current headline: **17.4 % token savings** with the deterministic hash backend.
  - Placeholders for `memory_relevance_eval`, `context_compression_eval`, `prompt_injection_eval`, `semantic_cache_eval`, `answer_quality_eval` clearly labelled as future work.
  - `docs/evaluations.md` and `docs/benchmarks.md`.
- Phase 12 — Markdown folder connector:
  - `integrations/markdown-folder/` shipped as `n0tune-markdown-folder` with a `n0tune-markdown-sync` CLI.
  - Walks `*.md` / `*.markdown` files, hashes content, calls `POST /v1/documents`, skips unchanged files on re-sync.
  - 5 new tests using mocked SDK transport.
  - `docs/connectors.md` documents the connector contract for future ones.
- Phase 13 — Local / offline mode:
  - `docs/local-mode.md` covering Ollama, LM Studio, vLLM, and `fastembed` paths.
  - `examples/local-ollama/README.md` rewritten as a runnable example with `host.docker.internal` notes for Linux, prerequisites, smoke commands, and troubleshooting.
- Phase 14 — Production deployment docs:
  - `docs/production.md` — env-var matrix, pre-deploy checklist, TLS + streaming proxy notes, logging redaction, upgrade strategy.
  - `docs/scaling.md` — layer-by-layer scaling guidance and pgvector HNSW index commands.
  - `docs/backup-restore.md` — backup tiers, end-user data deletion, disaster scenarios.
  - `docs/deployment-security.md` — network policy, secrets, container hardening, incident response.
  - `docs/observability.md` expanded with a production monitoring table and a Grafana-friendly query against `context_runs`.
- `docs/dogfooding.md` rewritten as a reproducible loop with the latest 17.4 % token-savings headline and an honest "what broke and what we changed" section.
- `img/logo.png` is committed and referenced from the top of the README.
- Issue templates for bugs, features, security reports, and docs issues plus a `config.yml` that disables blank issues and points users at Discussions and the private security policy. ([`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/))
- Pull request template with a structured "what / why / tests / docs / security / breaking / checklist" body. ([`.github/pull_request_template.md`](.github/pull_request_template.md))
- `docs/maintainers.md` — triage cadence, review checklist, release flow, hotfix flow, dependency hygiene.
- `docs/docs-style-guide.md` — voice, headings, code blocks, naming, examples-talk-to-the-API conventions.
- `docs/testing.md` — canonical list of test commands, layered surface table, smoke flow, secret scanning, and known gaps.
- `examples/personalized-rag-demo/README.md` and `evals/README.md` placeholders, each clearly labelled as v1.0 deliverables with the curl-only reproduction users can run today.
- LangChain integration package at `integrations/langchain/` (`pip install n0tune-langchain`). Ships `N0TuneRetriever(BaseRetriever)` that calls `/v1/context/preview` and returns memories + chunks as `langchain_core.documents.Document` (with `metadata.kind` of `"memory"` or `"chunk"`), plus an `N0TuneMemoryStore` helper for save/search/forget. Wired into CI.
- LlamaIndex integration package at `integrations/llamaindex/` (`pip install n0tune-llamaindex`). Ships `N0TuneRetriever(BaseRetriever)` returning `NodeWithScore` objects with similarity-scored memories and chunks, plus the same `N0TuneMemoryStore` helper. Wired into CI.
- Vercel AI SDK integration package at `integrations/vercel-ai-sdk/` (`@n0tune/vercel-ai-sdk`). `createN0TuneProvider()` returns an `@ai-sdk/openai` provider pointed at N0Tune's OpenAI-compatible `/v1/openai` endpoint (streaming, tool use, etc. work unchanged). `buildN0TuneSystemPrompt()` returns the compiled context as a system prompt for use with other Vercel AI SDK providers. `createN0TuneClient()` re-exports the standard `@n0tune/sdk` client.
- Optional Langfuse observability in `services/observability/langfuse.py`, wired into `POST /v1/chat` and `POST /v1/context/preview`. Each event records `app_id`, `user_id`, `request_id`, model, cache hit, token estimates, and the ids of selected memories and chunks. Enabled when `N0TUNE_LANGFUSE_PUBLIC_KEY` and `N0TUNE_LANGFUSE_SECRET_KEY` are set and the `langfuse` package is installed (added as an optional extra). Fail-open: missing package, missing keys, or a Langfuse exception all leave the request path untouched.
- `docs/observability.md` covering enablement, trace shape, fail-open guarantees, and how to swap in a different tracing backend.
- Python SDK at `packages/sdk-py/` (`pip install n0tune`). Synchronous `httpx`-based client with typed `pydantic` v2 models. Exposes resource namespaces `memories`, `style`, `documents`, `context`, `chat`, `cache`, plus a `health()` helper. Non-2xx responses raise `N0TuneError` carrying the status code and decoded body. Wired into CI alongside the API tests.
- `docs/k8s.md` — a Kubernetes deployment guide covering Postgres + pgvector (CloudNativePG / Zalando), Redis, API/dashboard `Deployment`+`Service`+`Ingress`, External Secrets Operator wiring, the Alembic migration `Job`, and a production checklist. Includes the streaming-friendly ingress annotation.
- Playwright dashboard e2e suite at `apps/dashboard/e2e/`. Scenarios cover memory creation, style profile update, document indexing + context preview (verifying the `tokens_saved_estimated` field renders), and clearing the semantic cache. Wired into CI as a new `e2e` job that boots the Docker Compose stack and waits for `/health` before running the tests; the Playwright HTML report is uploaded as an artifact.
- Pluggable embedding provider in `services/context/embedding.py`. `N0TUNE_EMBEDDING_PROVIDER` selects between the default deterministic `hash` backend, an OpenAI-compatible `openai` HTTP backend (uses the `dimensions` parameter to fit the `Vector(384)` schema), or a local `fastembed` backend (optional dependency). Failures fall back to the hash backend.
- Hybrid retrieval — a pure-Python BM25 implementation in `services/context/lexical.py` is blended into the compiler's scoring when `N0TUNE_HYBRID_LEXICAL_WEIGHT > 0`. Vector and lexical scores are min-max normalized before mixing so the weight always means the same thing.
- Optional `fastembed` extras group in `apps/api/pyproject.toml` so users opting into local embeddings install only what they need.
- Rate-limit middleware for `/v1/*` with a pluggable backend (`InMemoryRateLimitBackend` sliding window for single-process dev/tests, `RedisRateLimitBackend` fixed-window INCR+EXPIRE for multi-replica deployments). Configured via `N0TUNE_RATE_LIMIT_RPM`, `N0TUNE_RATE_LIMIT_WINDOW_SECONDS`, and `N0TUNE_RATE_LIMIT_BACKEND`. Disabled by default. Returns `429 Too Many Requests` with a `Retry-After` header. Caller key derives from Bearer token, `X-N0Tune-API-Key`, `X-Forwarded-For`, or the socket peer (in that order).
- Streaming Server-Sent Events for `POST /v1/openai/chat/completions` when `stream: true`. Emits `chat.completion.chunk` deltas split from the resolved answer (works for both live provider answers and semantic-cache hits) and terminates with `data: [DONE]`. The final chunk includes a `n0tune` block with cache hit, provider, and token-saving fields.
- Phase 7 hardening tests in `apps/api/app/tests/test_hardening.py`:
  - Semantic-cache TTL expiration forces a cache miss on the next chat.
  - Soft-deleted memories disappear from list (without `include_deleted`) and from context preview, while recreated memories with identical text get a fresh id without duplicating selections.
  - `/v1/chat` persists a `ContextRun` row whose trace contains both selected memories and excluded high-injection-risk chunks with reasons.
  - Parametrised unit tests for every pattern in `services/security/secrets.py` (OpenAI key, GitHub token, AWS access key, PEM private key, password assignment, bearer token, session cookie).
  - Mocked OpenAI-compatible upstream provider (via `respx`) is invoked with the expected model, system+user messages, and `Authorization: Bearer` header.
- `respx` added as an API dev dependency for HTTP-level provider mocking.
- Test conftest now exposes a `session_factory` fixture so tests can read/write the shared in-memory SQLite engine directly.

## 0.1.0 - 2026-05-16

### Added

- Phase 0 open-source repo foundation.
- Apache-2.0 license.
- Safe `.env.example`.
- Docker Compose stack with Postgres + pgvector, Redis, API, and dashboard services.
- FastAPI app with `GET /health`.
- Next.js dashboard placeholder with local API health display.
- Root documentation, security policy, contribution guide, code of conduct, and Phase 0 docs.
- Basic CI workflow for Python and Node lint/typecheck/tests, Compose config validation, secret scanning, and best-effort dependency audits.
- Pre-commit hook configuration.
- Alembic migrations for the MVP data model.
- Memory CRUD, style profile CRUD, documents, chunks, context preview, chat, cache, and OpenAI-compatible proxy endpoints.
- TypeScript SDK client.
- Dashboard pages for memory, style, documents, context preview, cache, and security.
- MCP stdio server.
- Dogfooding seed script and token-savings report.
- Tests for isolation, prompt injection, secret rejection, semantic cache hits, cache invalidation after memory changes, proxy, and health.

### Changed

- Secret scanning now runs the **Gitleaks CLI** in a dedicated [`.github/workflows/security.yml`](.github/workflows/security.yml). The previous `gitleaks/gitleaks-action@v2` job is removed from CI because the action requires a paid `GITLEAKS_LICENSE` secret on organization-owned repos and breaks CI for forks. `docs/security.md` documents both paths.
- `CONTRIBUTING.md` points contributors at the new issue/PR templates and the new docs (`docs/maintainers.md`, `docs/docs-style-guide.md`, `docs/testing.md`).

### Not yet implemented

- Latency-true pass-through streaming from an upstream provider (current streaming fans out a fully resolved answer).
- Native Postgres `tsvector` hybrid search (current implementation does BM25 in-process over already-fetched candidates).
- Async embedding HTTP client (current OpenAI embedding call is synchronous).
