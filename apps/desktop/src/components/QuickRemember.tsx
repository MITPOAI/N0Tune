import { useEffect, useRef, useState } from "react";

import { readClipboardText, onQuickRememberEvent } from "../tauri-bridge";

interface QuickRememberProps {
  onSave: (text: string) => Promise<void>;
}

/**
 * Quick-remember overlay.
 *
 * Triggered by the tray menu's "Quick remember…" item or the global hotkey
 * (Cmd+Shift+Space / Alt+Space). The Tauri Rust side emits the
 * "n0tune://quick-remember" event; we listen for it here.
 *
 * Pre-fills the textarea with the system clipboard so the typical flow is:
 * select text in any tool → hotkey → press Enter. Three keystrokes total.
 */
export function QuickRemember({ onSave }: QuickRememberProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const handler = onQuickRememberEvent(async () => {
        const clipboard = await readClipboardText();
        if (cancelled) return;
        setDraft(clipboard ?? "");
        setError(null);
        setOpen(true);
        // Focus + select-all on the next tick so the user can immediately
        // type / replace.
        window.requestAnimationFrame(() => {
          textareaRef.current?.focus();
          textareaRef.current?.select();
        });
      });
      unlisten = await handler;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  async function handleSave() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(text);
      setOpen(false);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="quick-remember-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Quick remember"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="quick-remember">
        <header>
          <h2>Quick remember</h2>
          <button
            type="button"
            className="link"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ESC
          </button>
        </header>
        <textarea
          ref={textareaRef}
          rows={3}
          placeholder="What should I remember?"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {error ? <p className="warnings">{error}</p> : null}
        <footer>
          <span className="muted small">
            {/macintosh|mac os x/i.test(navigator.userAgent)
              ? "⌘+Enter"
              : "Ctrl+Enter"}{" "}
            to save · ESC to dismiss
          </span>
          <button
            type="button"
            className="primary"
            disabled={!draft.trim() || busy}
            onClick={handleSave}
          >
            {busy ? "Saving…" : "Save memory"}
          </button>
        </footer>
      </div>
    </div>
  );
}
