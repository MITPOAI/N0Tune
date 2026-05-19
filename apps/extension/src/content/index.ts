/**
 * Content script — runs on claude.ai and chat.openai.com.
 *
 * Week-1 scaffold: detects the host, registers itself, and does
 * NOTHING else. Real DOM injection is week-2 work.
 *
 * The week-2 implementation will:
 *   1. Locate the chat textarea via accessible attributes
 *      (role="textbox", aria-label, contenteditable) — NOT class names.
 *   2. Intercept the send button click / Enter keystroke.
 *   3. Call chrome.runtime.sendMessage({type:"n0tune.compile", message})
 *      to get the compiled context from the background worker.
 *   4. Prepend the compiled context as a hidden first system message
 *      (per platform's mechanism — different on Claude vs ChatGPT).
 *   5. Let the original send proceed.
 *
 * Why not in v0.1.5: both platforms' DOMs change weekly; the right
 * thing is to ship the scaffold + popup + Gateway plumbing first,
 * verify they work end-to-end, then add injection behind a flag that
 * can be toggled off if the DOM changes underneath us.
 */

const host = window.location.hostname;
const platform =
  host.includes("claude.ai")
    ? "claude"
    : host.includes("chat.openai.com") || host.includes("chatgpt.com")
      ? "chatgpt"
      : "unknown";

// Log only in dev — the user can confirm via DevTools console that the
// extension is loaded on the right page. Production will silence this.
// eslint-disable-next-line no-console
console.debug(`[n0tune] content script loaded on ${platform} (${host})`);

// Stub: prove the background channel works. Removed in week-2.
chrome.runtime
  .sendMessage({ type: "n0tune.health" })
  .then((reply: { ok: boolean; data?: unknown; error?: string }) => {
    // eslint-disable-next-line no-console
    console.debug("[n0tune] gateway reachable:", reply);
  })
  .catch(() => {
    // Silent — the popup surfaces connection issues to the user.
  });
