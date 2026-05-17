import { MemoryViewer } from "../MemoryViewer";
import { RoomShell } from "./RoomShell";
import type { Memory } from "../../types";

interface LibraryRoomProps {
  memories: Memory[];
  onForget: (id: string) => Promise<void>;
  onSave: (text: string) => Promise<void>;
}

/**
 * The Library — everything N0Tune has stored about you.
 *
 * Today this is memories only; document indexing happens in the
 * Gateway. When the Desktop gets local file ingestion, an
 * "Indexed files" subsection slots in below the memory list
 * without changing the room metaphor.
 */
export function LibraryRoom({ memories, onForget, onSave }: LibraryRoomProps) {
  return (
    <RoomShell
      icon="📚"
      title="Library"
      subtitle={`${memories.length} ${
        memories.length === 1 ? "memory" : "memories"
      } stored locally`}
    >
      <MemoryViewer memories={memories} onForget={onForget} onSave={onSave} />
    </RoomShell>
  );
}
