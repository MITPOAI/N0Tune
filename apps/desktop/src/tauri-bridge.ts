/**
 * Optional Tauri bridge.
 *
 * When the renderer is running inside the Tauri webview, ``window.__TAURI_INTERNALS__``
 * exists and we can call Rust commands via ``invoke`` + subscribe to events
 * the Rust side emits (tray clicks, hotkey presses). The dev shell
 * (``npm run dev``) doesn't ship Tauri, so we import the modules
 * dynamically and silently fall back when they aren't available.
 */

export interface RuntimeInfo {
  runtime: string;
  version: string;
  tauri: string;
}

export interface UpdateAvailableEvent {
  current_version: string;
  latest_version: string;
  release_url: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getRuntimeInfo(): Promise<RuntimeInfo | null> {
  if (!isTauri()) return null;
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    return (await mod.invoke("runtime_info")) as RuntimeInfo;
  } catch {
    return null;
  }
}

/**
 * Read the system clipboard as plain text. Returns ``null`` outside Tauri
 * (browsers can't read the global clipboard without a user gesture, which
 * we don't have during a hotkey-triggered event).
 */
export async function readClipboardText(): Promise<string | null> {
  if (!isTauri()) {
    // In dev, optimistically try the browser API. May reject; that's fine.
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    const mod = await import(
      /* @vite-ignore */ "@tauri-apps/plugin-clipboard-manager"
    );
    return await mod.readText();
  } catch {
    return null;
  }
}

/**
 * Subscribe to the "n0tune://quick-remember" event the Rust side emits when
 * the tray "Quick remember…" item is clicked or the global hotkey fires.
 *
 * Returns a Promise that resolves to an unlisten function. Always returns
 * a noop unlistener outside Tauri so callers can use the same shape.
 */
export async function onQuickRememberEvent(handler: () => void): Promise<() => void> {
  if (!isTauri()) {
    return () => undefined;
  }
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/event");
    const unlisten = await mod.listen("n0tune://quick-remember", () => handler());
    return unlisten;
  } catch {
    return () => undefined;
  }
}

export async function onUpdateAvailableEvent(
  handler: (event: UpdateAvailableEvent) => void,
): Promise<() => void> {
  if (!isTauri()) {
    return () => undefined;
  }
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/event");
    const unlisten = await mod.listen<UpdateAvailableEvent>(
      "n0tune://update-available",
      (event) => handler(event.payload),
    );
    return unlisten;
  } catch {
    return () => undefined;
  }
}

/**
 * Typed wrapper for `invoke`. Returns `null` if we're not in Tauri so
 * callers can fall back to the localStorage backend transparently.
 */
export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    return (await mod.invoke(command, args)) as T;
  } catch {
    return null;
  }
}
