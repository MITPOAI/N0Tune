# N0Tune v0.1.5 — UX Audit

**Date:** 2026-05-19 · **Scope:** Desktop (Tauri, 7 rooms) + Dashboard (Next.js SPA, 9 tabs) · **Mode:** static-read + live-render screenshots at 1280×800

## TL;DR — verdict: **PASS** for v0.1.5 (0 P0, 4 P1, 6 P2)

The unified palette and the mansion redesign are coherent, the dark-mode contrast fix is real (the comment in [`styles.css:30-31`](../apps/desktop/src/styles.css) is honest), and both surfaces share visual DNA without sharing tokens. The two notable risks for v0.2 are (a) the Dashboard "Context" / Live-trace panel overflows the right edge of a 1280-wide viewport, hiding the very pills (`tokens`, `saved`, `warnings`) that prove the system's value; (b) stale-image deployment silently dropped a working API endpoint (`/v1/users/{user_id}/style/adapt`) from production until rebuilt.

### Severity scale

| | Meaning |
|---|---|
| **P0** | Ship-blocker, broken or unsafe |
| **P1** | Ship-blocker for v0.2 (fix before next tag) |
| **P2** | Polish for v0.2 (queue, don't gate) |
| **P3** | Nit (note, ignore until something else touches the file) |

### Findings count

| Severity | Count | Themes |
|---:|---:|---|
| P0 | 0 | — |
| P1 | 4 | Dashboard overflow at 1280, stale-image deployment, sales style-adapt false direction, "Context" naming |
| P2 | 6 | Logo `alt=""`, mansion metaphor cohesion, no apply-suggestion affordance, missing live region, Onboarding "stored in OS keychain on signed builds" caveat in copy, doc-vs-memory ranking |
| P3 | 5 | Cosmetic nits in copy, sidebar room icons, screen-reader narration on activity feed |

## 1. Tokens & design system

### Light mode (`apps/desktop/src/styles.css:1-24`)

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#faf9f6` | Warm off-white. AAA against `--ink`. |
| `--surface` | `#ffffff` | Card backgrounds. |
| `--line` | `#e7e5df` | 1.07:1 against `--bg` — separator, not text. Acceptable. |
| `--ink` | `#18130c` | ~17:1 on `--bg` — AAA. |
| `--ink-mute` | `#5b554c` | ~6.5:1 on `--bg` — AA for normal text. |
| `--accent` | `#2c4a8f` | ~7.5:1 on `--bg` — AAA. |
| `--accent-soft` | `#e3ebf9` | Focus-ring background only — not used for text. |
| `--warn` | `#b75221` | ~5:1 on `--bg` — AA. |
| `--field` | `#f3f1ea` | Input bg. Adjacent to `--bg`; intentional subtle differentiation. |

### Dark mode (`apps/desktop/src/styles.css:26-43`)

The committed code includes an explicit comment that `--line` was bumped from `#2e2a25` to `#3d3930` to pass WCAG AA — this is real (1.6:1 → ~3.1:1). Other dark-mode pairs check cleanly (≥9:1 for text, ≥3:1 for non-text UI).

**P3 — `--accent-soft` token in dark mode** is `#1f2a44`. Should it be used as a text background? Visually it works for focus rings but it isn't documented either way. No action needed; just worth one comment in the token file.

### Cross-surface token alignment

**P1 — Dashboard does not consume Desktop tokens.** Dashboard uses Tailwind defaults (`bg-black` for the Refresh button); Desktop uses `--ink: #18130c`. They're visually almost-the-same but a brand audit would catch the divergence. With "two equal surfaces" being the v0.1.5 messaging, sharing a single token export (e.g. CSS variables in `apps/dashboard/app/globals.css` mirroring `apps/desktop/src/styles.css`) would tighten this. Not a P0 because nothing is broken; P1 because the two surfaces will drift further until aligned.

### P2 — Component duplication between `ContextPreview.tsx` (Desktop) and the Dashboard's Context tab

Both render the same shape: prompt textarea + Compile button + selected_memories list + selected_chunks list + trace. They almost certainly diverged independently. Worth extracting a shared TS contract (the `ContextPreviewResponse` type from `packages/sdk-js/src/types.ts`) and possibly a shared React component if/when the SDK grows React utilities.

## 2. Accessibility — WCAG 2.1 AA snapshot

| Test | Surface | Result | Source |
|---|---|---|---|
| Contrast ratio (text on bg, light) | Desktop, Dashboard | ✅ AAA for primary text, AA for muted | `styles.css:1-24` |
| Contrast ratio (text on bg, dark) | Desktop | ✅ AAA after `--line` bump | `styles.css:26-43` |
| Semantic landmarks | Desktop | ✅ `<nav>`, `<main>`, `<footer>`, `<header>`, `<section>` | per exploration of `App.tsx`, `Sidebar.tsx` |
| Modal trap (`role="dialog"`, `aria-modal`) | Desktop | ✅ on QuickRemember | `QuickRemember.tsx:87-89` |
| Focus rings | Both | ✅ `outline + box-shadow` on inputs / buttons | `styles.css:86-89, 261-264` |
| Keyboard shortcuts (Cmd/Alt+Space, Esc, Ctrl+Enter) | Desktop | ✅ implemented | `QuickRemember.tsx:54-59` |
| `lang` attribute on `<html>` | Both | ❌ missing | `index.html` |
| Live region for activity-feed updates | Desktop | ❌ missing | `HomeRoom.tsx` |
| Image alt text | Desktop | ⚠ logo has `alt=""` ([`Onboarding.tsx:61`](../apps/desktop/src/components/Onboarding.tsx)) | onboarding |
| Touch / click target ≥ 24×24 | Both | mostly ✅ — `.status-pill` borderline | `styles.css:887-938` |
| Reduced-motion support | Both | ❌ no `prefers-reduced-motion` query observed | `styles.css` |

### Concrete P1 a11y items

1. **P1 — `lang` on `<html>`** is missing on both surfaces. Trivial fix in `index.html` and `apps/dashboard/app/layout.tsx`.
2. **P2 — Logo `alt=""`** on the onboarding screen ([`Onboarding.tsx:61`](../apps/desktop/src/components/Onboarding.tsx)). The page already has an h1 immediately after, so this is borderline-correct (decorative-with-adjacent-text); a screen reader will say "Set up your personal AI" without preamble. Defensible. Make it `alt="N0Tune"` if you want unambiguous branding for assistive tech.
3. **P2 — No `prefers-reduced-motion` guard** around the `n0-pulse` animation in the pipeline diagram (`styles.css:1012-1093`) and the home-door hover lift. Add a media query: `@media (prefers-reduced-motion: reduce) { ... animation: none; transform: none; }`.
4. **P3 — Activity feed in Home room** updates without aria-live announcement. Add `aria-live="polite"` to the container.

## 3. Live render — observations from running probes

Screenshots in repo root: `.scenario-mkt-trace.png`, `.scenario-code-trace.png`, `.scenario-health-trace.png`.

### P1 — Dashboard "Context" right-panel overflow at 1280×800

In all three captured screenshots, the right panel (Selected memories / Selected docs / Trace) extends past the 1280 viewport. The header row's three pills — `tokens X`, `saved X`, `warnings X` — get clipped off the right edge. This is the headline differentiator surface (Live trace = "we show you exactly which memories made it in and which got dropped, and how many tokens we saved"). Hiding the savings number is a real product cost.

**Fix:** flex-wrap the header pills or make the right panel `min-w-0` so memory rows truncate instead of forcing horizontal scroll. Verify at 1280×800, 1366×768 (most common Windows laptop), and 1024 (smallest reasonable target).

### P1 — Stale-image deployment risk

While running the matrix, the `POST /v1/users/{user_id}/style/adapt` endpoint returned 404. The route exists in the source ([`apps/api/app/routes/style.py:123`](../apps/api/app/routes/style.py)) but was missing from the running container. Root cause: `apps/api/Dockerfile` line 13 `COPY apps/api/app ./apps/api/app` copies at build time, and `docker compose up -d --wait` re-creates containers from the cached image rather than rebuilding. A developer adding a new API route would not notice this locally if they only re-run `up` and not `build`.

**Fix options (pick one or both):**
- Add a docs paragraph to [`docs/release-checklist.md`](release-checklist.md): "When adding routes, run `docker compose build api` before checking the dashboard."
- Add a sanity check to [`scripts/seed-alignment-rules.py`](../scripts/seed-alignment-rules.py)-style boot script that GETs `/openapi.json` and asserts a known set of routes is present. CI for the docker-compose path.

This UX-relevant because users *think* they're testing v0.1.5 but are running an older image. Subtle and high-trust-cost.

## 4. Information architecture

### P1 — "Live trace" is named "Context" in the Dashboard

The README, prior release notes, and the explore agent's report all call it the "Live trace tab". The actual sidebar label is **Context** (group: Run, subtitle: "Compile + preview a request"). A docs grep would surface this drift. There's also a separate **Context Lab** (group: Start, subtitle: "Compare two users live") which is a different feature.

**Fix:** rename the sidebar label to "Live trace" (or "Live retrieval trace"). Then the docs are consistent and the value prop ("see exactly what context goes into the model") is on the label.

### Mansion metaphor coherence (Desktop)

- **Home** ⌂ — lobby. Clear.
- **Library** 📚 — saved memories. Clear.
- **Atelier** ✎ — persona / voice tuning. *Why "atelier"? An atelier is a studio. The room tunes how the AI speaks; "Voice" or "Studio" would be more direct.* P2.
- **Wire** 🔌 — provider config. Clear, slightly geeky.
- **Guard** ⚖ — alignment checker. Clear.
- **Forge** 🔥 — compile trace. *"Forge" implies creation; the actual content is read-only inspection of what was compiled. "Trace" or "Compile log" would be more honest.* P2.
- **Chat** ▢ — fallback chat. Clear.

The mansion is delightful and the icons help, but two rooms (Atelier, Forge) require explanation. First-time users will guess, and the guess won't always be right. Either:
- (a) keep the names, add a one-line tooltip on the sidebar room hint, or
- (b) rename to function-first labels (Voice, Trace).

This is a deliberate brand call, not an a11y or correctness issue.

## 5. Copy review

### Onboarding ([`Onboarding.tsx:62-66`](../apps/desktop/src/components/Onboarding.tsx))

> "Set up your personal AI"
> "N0Tune doesn't train the model. It adds local memory, style, and context around any provider you choose."

✅ Clear, honest, brand-coherent. Uses typographic apostrophe (good attention to detail).

### P2 — "API key (stored in the OS keychain on signed builds; in-memory only here)" ([`Onboarding.tsx:124`](../apps/desktop/src/components/Onboarding.tsx))

This is technically honest but reads anxious. A first-time user pasting a real key sees "in-memory only here" and may pause. Better:

> "API key — held only in this session. Signed builds store it in your OS keychain."

(Same fact, less hedging.)

### P3 — Empty states

- "No selected memories" / "No selected chunks" / "No trace yet" / "Nothing excluded" — terse and consistent. Good.
- "No preview yet." in the compiled-output box — could be more inviting: "Click 'Compile context' to see what would be sent to the model."

### P3 — MCP tool descriptions ([`integrations/mcp-server/src/server.mjs`](../integrations/mcp-server/src/server.mjs))

The 8 tool descriptions are concise but follow inconsistent voice: some imperative ("Search user memories…"), some declarative ("Stores long-term user memory"). Pick one (imperative is more standard for tools) and align all 8.

## 6. Cross-surface consistency (Desktop ↔ Dashboard)

| Surface | Color tokens | Type family | Component lib | Tested |
|---|---|---|---|---|
| Desktop | CSS variables in `styles.css` | Inter + system | custom CSS | manually |
| Dashboard | Tailwind defaults | Tailwind default | (likely Tailwind + custom) | manually |

They share aesthetic DNA — warm off-white, generous whitespace, ink-dark primary text — but **not tokens**. Visual drift between v0.1.5 and v0.2 is the predictable outcome. See P1 in §1.

## 7. Fix list (prioritized)

| # | Sev | Where | Fix |
|---|:-:|---|---|
| 1 | P1 | [`apps/dashboard/components/dashboard-app.tsx`](../apps/dashboard/components/dashboard-app.tsx) (Live-trace right panel) | Flex-wrap header pills; `min-w-0` on right column; verify at 1280×800 / 1366×768 / 1024 |
| 2 | P1 | [`docs/release-checklist.md`](release-checklist.md) | Add "rebuild api image when routes change" step + boot-time route-assertion script |
| 3 | P1 | Dashboard sidebar | Rename "Context" → "Live trace" (with subtitle "Compile + preview"); keep "Context Lab" |
| 4 | P1 | [`apps/api/app/services/style/`](../apps/api/app/services/style/) | Add negation handling to keyword voter (don't count "academic" if preceded by "skip", "no", "not", "never") |
| 5 | P2 | Dashboard tokens | Mirror Desktop CSS variables in `apps/dashboard/app/globals.css` to lock palette parity |
| 6 | P2 | [`apps/desktop/src/styles.css`](../apps/desktop/src/styles.css) | Add `@media (prefers-reduced-motion: reduce) { ... }` guard around `n0-pulse` and `.home-door:hover` transforms |
| 7 | P2 | [`apps/desktop/src/components/Onboarding.tsx:124`](../apps/desktop/src/components/Onboarding.tsx) | Soften API-key disclosure copy |
| 8 | P2 | Both index files | Add `lang="en"` to `<html>` |
| 9 | P2 | Mansion rooms | Decide: keep poetic names + tooltips, OR rename Atelier → Voice and Forge → Trace |
| 10 | P2 | Atelier room | Surface a "Apply suggestion" CTA next to each style/adapt suggestion (currently suggestion-only with no UI path to apply) |
| 11 | P3 | [`apps/desktop/src/components/HomeRoom.tsx`](../apps/desktop/src/components/HomeRoom.tsx) | Wrap activity feed in `aria-live="polite"` |
| 12 | P3 | [`integrations/mcp-server/src/server.mjs`](../integrations/mcp-server/src/server.mjs) | Standardize MCP tool descriptions to imperative voice |
| 13 | P3 | Dashboard | Replace "No preview yet." with action-oriented copy |
| 14 | P3 | [`apps/desktop/src/components/Onboarding.tsx:61`](../apps/desktop/src/components/Onboarding.tsx) | Change `alt=""` to `alt="N0Tune"` |
| 15 | P3 | [`apps/desktop/src/components/sidebar.css`](../apps/desktop/src/components) | Confirm sidebar room icons are ≥24px hit target |

None of the above are gated for v0.1.5 — the tag is shipped. They are the queue for v0.2.

## 8. What the audit cannot verify (honest)

- **Screen reader narration of the Live trace tab.** I drove the dashboard with eval(), not NVDA/VoiceOver. The semantic structure is sound but actual TTS pronunciation of "MMR" and similarity scores (e.g. "0.25") was not heard.
- **Color blindness simulation.** The palette has only `--accent` (blue) and `--warn` (orange) as semantic hues — both distinguishable in deuteranopia simulation by luminance, but unverified.
- **Mobile / tablet.** Out of scope per CLAUDE.md (Tauri is desktop-only; Dashboard is admin-only).
- **The mansion-metaphor "delight test."** Whether new users *enjoy* the metaphor or find it cute-but-confusing is a research question (user interview, not file inspection).
