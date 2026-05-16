import { useEffect, useState } from "react";

import type { Persona, StyleProfile } from "../types";

interface PersonaSettingsProps {
  persona: Persona | null;
  onUpdate: (next: Partial<Persona>) => Promise<void>;
}

export function PersonaSettings({ persona, onUpdate }: PersonaSettingsProps) {
  const [name, setName] = useState(persona?.name ?? "Milo");
  const [personality, setPersonality] = useState(persona?.personality ?? "");
  const [style, setStyle] = useState<StyleProfile>(
    persona?.style ?? { tone: "casual", depth: "medium", format: "examples", avoid: [] },
  );
  const [memoryMode, setMemoryMode] = useState<Persona["memoryMode"]>(
    persona?.memoryMode ?? "auto",
  );
  const [avoidText, setAvoidText] = useState(persona?.style?.avoid?.join(", ") ?? "");

  useEffect(() => {
    if (!persona) return;
    setName(persona.name);
    setPersonality(persona.personality);
    setStyle(persona.style);
    setMemoryMode(persona.memoryMode);
    setAvoidText(persona.style.avoid.join(", "));
  }, [persona]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    await onUpdate({
      name,
      personality,
      memoryMode,
      style: {
        ...style,
        avoid: avoidText
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      },
    });
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Persona</h2>
      </header>

      <form className="settings-form" onSubmit={handleSave}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Personality
          <textarea
            rows={2}
            value={personality}
            onChange={(event) => setPersonality(event.target.value)}
          />
        </label>
        <div className="grid-2">
          <label>
            Tone
            <input
              value={style.tone}
              onChange={(event) => setStyle({ ...style, tone: event.target.value })}
            />
          </label>
          <label>
            Depth
            <input
              value={style.depth}
              onChange={(event) => setStyle({ ...style, depth: event.target.value })}
            />
          </label>
        </div>
        <label>
          Format
          <input
            value={style.format}
            onChange={(event) => setStyle({ ...style, format: event.target.value })}
          />
        </label>
        <label>
          Avoid (comma-separated)
          <input value={avoidText} onChange={(event) => setAvoidText(event.target.value)} />
        </label>
        <label>
          Memory mode
          <select
            value={memoryMode}
            onChange={(event) => setMemoryMode(event.target.value as Persona["memoryMode"])}
          >
            <option value="auto">auto — store useful memories silently</option>
            <option value="review">review — surface candidate memories for approval</option>
            <option value="manual">manual — only save memories I explicitly add</option>
            <option value="off">off — don’t learn between sessions</option>
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </section>
  );
}
