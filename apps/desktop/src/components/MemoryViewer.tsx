import { useState } from "react";

import type { Memory, MemoryType } from "../types";

interface MemoryViewerProps {
  memories: Memory[];
  onForget: (id: string) => Promise<void>;
  onSave: (text: string) => Promise<void>;
}

const MEMORY_TYPES: MemoryType[] = [
  "preference",
  "goal",
  "project",
  "correction",
  "style",
  "fact",
];

export function MemoryViewer({ memories, onForget, onSave }: MemoryViewerProps) {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"all" | MemoryType>("all");

  const filtered =
    filter === "all" ? memories : memories.filter((memory) => memory.type === filter);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await onSave(text);
    setDraft("");
  }

  return (
    <section className="panel memory-viewer">
      <header className="panel-header">
        <h2>Memories</h2>
        <div className="memory-filters">
          <button
            type="button"
            className={`chip ${filter === "all" ? "chip--active" : ""}`}
            onClick={() => setFilter("all")}
          >
            all ({memories.length})
          </button>
          {MEMORY_TYPES.map((type) => {
            const count = memories.filter((memory) => memory.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                type="button"
                className={`chip ${filter === type ? "chip--active" : ""}`}
                onClick={() => setFilter(type)}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <form className="memory-add" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Add a memory…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="primary" disabled={!draft.trim()}>
          Save
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="empty">No memories yet.</p>
      ) : (
        <ul className="memory-list">
          {filtered.map((memory) => (
            <li key={memory.id} className="memory-row">
              <div>
                <strong>{memory.type}</strong>
                <p>{memory.text}</p>
                <p className="muted">
                  conf {Math.round(memory.confidence * 100)}% · {memory.state} · scope{" "}
                  {memory.scope}
                </p>
              </div>
              <button type="button" className="link" onClick={() => onForget(memory.id)}>
                Forget
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
