# Floating widget (planning doc)

> :construction: Not implemented. This doc captures the shape so contributors
> can pick it up without re-deciding the basics.

The floating widget is the always-on N0Tune surface: a small window or tray
icon you can summon with a hotkey, ask a quick question, and dismiss. It is
**not** a 3D character. 3D and Live2D avatars are explicitly deferred until
the 2D path is solid.

## Goals

- **Cheap to spawn.** Hotkey → answer in under one second on warm cache.
- **Honest by default.** No telemetry. No "always listening." The widget is
  inert until summoned.
- **Stays out of the way.** Translucent, draggable, dismisses on blur, can
  be pinned.
- **One personality at a time.** The widget uses the current persona from
  the main Desktop window. It does not invent its own.

## Surface

Two surfaces, picked per OS:

1. **Tray icon + popover** on macOS and Windows. Click the tray icon (or
   hit the configured global hotkey) → a 320×420-ish popover anchored
   under the icon. ESC dismisses.
2. **Always-on-top mini window** on Linux. Same chat shape, draggable.

The chat surface itself reuses `apps/desktop/src/components/Chat.tsx` so
behaviour stays identical between the main window and the widget.

## Hotkey

- Default: `Alt+Space` on Windows/Linux, `Cmd+Shift+Space` on macOS.
- Configurable in `Settings → Persona`.
- We use Tauri's global-shortcut plugin once we ship the Rust side; until
  then, the hotkey is a no-op.

## 2D avatar

The widget shows the persona's avatar (default: `img/logo.png`). Users can
upload a PNG to override. We store it at:

- macOS: `~/Library/Application Support/N0Tune/avatars/<persona>.png`
- Windows: `%APPDATA%\N0Tune\avatars\<persona>.png`
- Linux: `~/.local/share/n0tune/avatars/<persona>.png`

We do **not** download avatars from arbitrary URLs at runtime — that's a
prompt-injection-shaped attack surface.

## Voice and listening

Not in scope for the first widget. Adding voice means microphone
permissions, wake words, and another consent surface; we ship without it
until the rest of the widget is stable.

## What we don't ship

- 3D characters. Live2D, VRM, or anything that requires a render loop. The
  positioning copy in the README is intentional: this is N0Tune, not a
  desktop pet.
- Webcam input. Not a v1 concern.
- Network-listening helpers. The widget talks to the local Desktop runtime
  (or the configured Gateway), nothing else.

## Open questions

- Does the widget need its own MCP entry point, or does it inherit from
  the main Desktop's MCP install? Working hypothesis: inherit.
- Is the hotkey reservable globally, or is the OS picker the right call?
  Working hypothesis: reservable + a "find a hotkey" dialog in settings.
- Where does the persona avatar live when the widget is in a tray
  popover that's narrower than 240px? Working hypothesis: 32×32 with the
  persona name as a tooltip.

These get answered when the widget lands. Open a feature-request issue
([.github/ISSUE_TEMPLATE/feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml))
if you have an opinion.
