/**
 * Background service worker.
 *
 * Manifest v3 services workers wake up on demand. Content scripts post
 * messages to us; we hit the Gateway via fetch (content scripts can't
 * always cross-origin freely, but service workers can with the
 * declared host_permissions in manifest.json).
 *
 * Message shape (request from content script):
 *   { type: "n0tune.compile", message: string }      → ContextPreview
 *   { type: "n0tune.save",    text: string, kind?: string } → { id }
 *   { type: "n0tune.health" }                        → { ok: true }
 *
 * Reply shape: { ok: true, data } or { ok: false, error: string }.
 *
 * Content-script injection itself is week-2 work — see src/content/
 * index.ts for the placeholder.
 */

import { loadConfig } from "../lib/config";
import { compileContext, healthcheck, saveMemory } from "../lib/gateway";

type Req =
  | { type: "n0tune.compile"; message: string }
  | { type: "n0tune.save"; text: string; kind?: string }
  | { type: "n0tune.health" };

chrome.runtime.onMessage.addListener(
  (req: Req, _sender, sendResponse: (r: unknown) => void) => {
    void (async () => {
      try {
        const config = await loadConfig();
        if (!config.enabled) {
          sendResponse({ ok: false, error: "extension disabled in popup" });
          return;
        }
        switch (req.type) {
          case "n0tune.compile": {
            const data = await compileContext(config, req.message);
            sendResponse({ ok: true, data });
            return;
          }
          case "n0tune.save": {
            const data = await saveMemory(
              config,
              req.text,
              req.kind ?? "preference",
            );
            sendResponse({ ok: true, data });
            return;
          }
          case "n0tune.health": {
            await healthcheck(config.gatewayUrl);
            sendResponse({ ok: true, data: { reachable: true } });
            return;
          }
        }
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    // Returning true keeps the message channel open for the async reply.
    return true;
  },
);
