import { ProviderSettings } from "../ProviderSettings";
import { RoomShell } from "./RoomShell";
import type { ProviderConfig } from "../../types";

interface WireRoomProps {
  provider: ProviderConfig | null;
  onSave: (next: ProviderConfig) => Promise<void>;
}

/**
 * Wire — provider connections. The room makes the system's job
 * obvious: "this is where you plug AI into the wiring N0Tune
 * already laid down."
 *
 * Today this is one configured provider at a time; the next iteration
 * will surface OpenAI / Anthropic / Gemini / OpenAI-compatible as
 * four sockets with a "Test connection" button per socket. The room
 * shell stays the same.
 */
export function WireRoom({ provider, onSave }: WireRoomProps) {
  return (
    <RoomShell
      icon="🔌"
      title="Wire"
      subtitle={
        provider
          ? `${provider.label} configured — model: ${provider.model ?? "(default)"}`
          : "No provider yet — wire in OpenAI, Claude, Gemini, or an OpenAI-compatible endpoint"
      }
    >
      <ProviderSettings provider={provider} onSave={onSave} />
    </RoomShell>
  );
}
