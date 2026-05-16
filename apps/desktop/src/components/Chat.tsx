import { useRef, useState } from "react";

import type { ChatResponse, ChatTurn, Persona } from "../types";

interface ChatProps {
  persona: Persona | null;
  onSend: (message: string) => Promise<ChatResponse>;
  onSaveMemory: (text: string) => Promise<void>;
}

export function Chat({ persona, onSend, onSaveMemory }: ChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setDraft("");

    const turnId = Math.random().toString(36).slice(2);
    setTurns((prev) => [
      ...prev,
      { id: `${turnId}-u`, role: "user", content: message, createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await onSend(message);
      setLastResponse(response);
      setTurns((prev) => [
        ...prev,
        {
          id: `${turnId}-a`,
          role: "assistant",
          content: response.answer,
          createdAt: new Date().toISOString(),
        },
      ]);
      window.requestAnimationFrame(() => {
        transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickRemember() {
    const text = window.prompt(`Save what for ${persona?.name ?? "your AI"} to remember?`);
    if (text && text.trim()) {
      await onSaveMemory(text.trim());
    }
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <div>
          <h2>{persona?.name ?? "N0Tune"}</h2>
          <p className="muted">{persona?.personality ?? "Personal AI runtime"}</p>
        </div>
        <button type="button" className="link" onClick={handleQuickRemember}>
          Remember…
        </button>
      </header>

      <div className="chat-transcript" ref={transcriptRef}>
        {turns.length === 0 ? (
          <div className="empty">
            <p>Say hello.</p>
            <p className="muted">
              Try: <em>“Remember I prefer terse code-first answers.”</em>
            </p>
            <p className="muted small">
              Each answer shows a context log below: which memories were
              selected, estimated tokens, and which provider answered.
            </p>
          </div>
        ) : (
          turns.map((turn) => (
            <article key={turn.id} className={`turn turn--${turn.role}`}>
              <header>
                {turn.role === "user" ? "You" : persona?.name ?? "Assistant"}
              </header>
              <pre>{turn.content}</pre>
            </article>
          ))
        )}
      </div>

      {lastResponse ? (
        <details className="chat-trace" open>
          <summary>
            <span>
              ~{lastResponse.trace.prompt_tokens_estimated} tokens compiled ·{" "}
              ~{lastResponse.trace.tokens_saved_estimated} saved · provider:{" "}
              <strong>{lastResponse.provider}</strong>
            </span>
            <span>
              {lastResponse.trace.selected_memories.length} memor
              {lastResponse.trace.selected_memories.length === 1 ? "y" : "ies"}{" "}
              used
            </span>
          </summary>
          <div className="chat-trace-body">
            {lastResponse.trace.selected_memories.length > 0 && (
              <div>
                <h4>Memories</h4>
                <ul>
                  {lastResponse.trace.selected_memories.map((memory) => (
                    <li key={memory.id}>
                      <span className="badge">{memory.type}</span> {memory.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lastResponse.trace.why_selected.length > 0 && (
              <div>
                <h4>Why selected</h4>
                <ul>
                  {lastResponse.trace.why_selected.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <span className="badge">{item.type}</span> {item.id} —{" "}
                      <span className="muted">{item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lastResponse.trace.warnings.length > 0 && (
              <div className="warnings">
                {lastResponse.trace.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        </details>
      ) : null}

      <form className="chat-input" onSubmit={handleSend}>
        <textarea
          rows={2}
          placeholder="Message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend(event);
            }
          }}
        />
        <button type="submit" className="primary" disabled={busy || !draft.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
