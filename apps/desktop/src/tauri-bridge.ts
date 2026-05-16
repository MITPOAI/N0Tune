/**
 * Optional Tauri bridge.
 *
 * When the renderer is running inside the Tauri webview, ``window.__TAURI_INTERNALS__``
 * exists and we can call Rust commands via ``invoke``. The dev shell
 * (``npm run dev``) doesn't ship Tauri, so we import the module dynamically
 * and silently fall back when it isn't available.
 */

export interface RuntimeInfo {
  runtime: string;
  version: string;
  tauri: string;
}

export async function getRuntimeInfo(): Promise<RuntimeInfo | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    return (await mod.invoke("runtime_info")) as RuntimeInfo;
  } catch {
    return null;
  }
}
