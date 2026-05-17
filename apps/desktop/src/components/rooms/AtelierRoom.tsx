import { PersonaSettings } from "../PersonaSettings";
import { RoomShell } from "./RoomShell";
import type { Persona } from "../../types";

interface AtelierRoomProps {
  persona: Persona | null;
  onUpdate: (next: Partial<Persona>) => Promise<void>;
}

/**
 * The Atelier — your persona and style. Where the tone, depth,
 * format, and "things to avoid" knobs live. Renaming the existing
 * Persona surface as a room keeps it as one of the six mansion
 * doors instead of a settings tab.
 */
export function AtelierRoom({ persona, onUpdate }: AtelierRoomProps) {
  const tone = persona?.style?.tone ?? "casual";
  const depth = persona?.style?.depth ?? "medium";
  return (
    <RoomShell
      icon="✎"
      title="Atelier"
      subtitle={
        persona
          ? `Speaking as ${persona.name} — ${tone}, ${depth} depth`
          : "Set up the persona that shapes every answer"
      }
    >
      <PersonaSettings persona={persona} onUpdate={onUpdate} />
    </RoomShell>
  );
}
