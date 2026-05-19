/**
 * Extension config storage.
 *
 * Lives in chrome.storage.local. Read by the popup (UI), the background
 * worker (Gateway requests), and the content scripts (whether to
 * inject at all).
 */

export type ExtensionConfig = {
  enabled: boolean;
  gatewayUrl: string;
  appId: string;
  userId: string;
  apiKey: string;
};

export const defaultConfig: ExtensionConfig = {
  enabled: true,
  gatewayUrl: "http://localhost:8000",
  appId: "demo",
  userId: "n0tune_builder",
  apiKey: "",
};

const STORAGE_KEY = "n0tune.config.v1";

export async function loadConfig(): Promise<ExtensionConfig> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return defaultConfig;
  }
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as Partial<ExtensionConfig> | undefined;
  return { ...defaultConfig, ...(raw ?? {}) };
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}
