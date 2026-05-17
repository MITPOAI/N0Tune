import { ContextPreview } from "../ContextPreview";
import { RoomShell } from "./RoomShell";
import type { ContextTrace } from "../../types";

interface ForgeRoomProps {
  trace: ContextTrace | null;
}

/**
 * The Forge — where N0Tune compiles a prompt from your memory,
 * persona, and the user message. The trace shows which memories
 * were selected and why, plus tokens used vs the naive baseline.
 *
 * This is the room that demonstrates context-tuning concretely:
 * same model, different prompt, personal answer.
 */
export function ForgeRoom({ trace }: ForgeRoomProps) {
  const hasTrace = trace !== null;
  const memoryCount = trace?.selected_memories.length ?? 0;
  return (
    <RoomShell
      icon="🔥"
      title="Forge"
      subtitle={
        hasTrace
          ? `Last forge used ${memoryCount} ${
              memoryCount === 1 ? "memory" : "memories"
            } and ${trace?.prompt_tokens_estimated ?? 0} prompt tokens`
          : "Send your first message in Chat — the compile trace appears here"
      }
    >
      <ContextPreview trace={trace} />
    </RoomShell>
  );
}
