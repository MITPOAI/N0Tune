import type { ComponentProps } from "react";

export type RoomKey =
  | "home"
  | "library"
  | "atelier"
  | "wire"
  | "guard"
  | "forge"
  | "chat";

interface RoomDef {
  key: RoomKey;
  label: string;
  icon: string;
  hint: string;
}

/** Mansion layout. Each room is a distinct surface, in flow order.
 *
 *  Icons are deliberately geometric (single-glyph monospace) — emoji
 *  rendered inconsistently across Windows / macOS / Linux at the small
 *  sidebar size. These glyphs match the Dashboard sidebar so a user
 *  hopping between Dashboard and Desktop sees the same visual language. */
const ROOMS_PRIMARY: RoomDef[] = [
  { key: "home", label: "Home", icon: "◎", hint: "System map + activity" },
  { key: "library", label: "Library", icon: "▤", hint: "Memories + files" },
  { key: "atelier", label: "Atelier", icon: "✎", hint: "Persona + style" },
  { key: "wire", label: "Wire", icon: "⇌", hint: "Provider connections" },
  { key: "guard", label: "Guard", icon: "⚿", hint: "Alignment + rules" },
  { key: "forge", label: "Forge", icon: "▶", hint: "Compile a prompt" },
];

const ROOMS_FALLBACK: RoomDef[] = [
  { key: "chat", label: "Chat", icon: "≡", hint: "Fallback chat" },
];

interface SidebarProps {
  active: RoomKey;
  onSelect: (room: RoomKey) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="N0Tune rooms">
      <ol className="sidebar-rooms">
        {ROOMS_PRIMARY.map((room) => (
          <SidebarItem
            key={room.key}
            room={room}
            active={active === room.key}
            onClick={() => onSelect(room.key)}
          />
        ))}
      </ol>
      <div className="sidebar-divider" aria-hidden />
      <ol className="sidebar-rooms sidebar-rooms--fallback">
        {ROOMS_FALLBACK.map((room) => (
          <SidebarItem
            key={room.key}
            room={room}
            active={active === room.key}
            onClick={() => onSelect(room.key)}
          />
        ))}
      </ol>
    </nav>
  );
}

interface ItemProps extends Pick<ComponentProps<"button">, "onClick"> {
  room: RoomDef;
  active: boolean;
}

function SidebarItem({ room, active, onClick }: ItemProps) {
  return (
    <li>
      <button
        type="button"
        className={`sidebar-room ${active ? "sidebar-room--active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        <span className="sidebar-room-icon" aria-hidden>
          {room.icon}
        </span>
        <span className="sidebar-room-body">
          <span className="sidebar-room-label">{room.label}</span>
          <span className="sidebar-room-hint">{room.hint}</span>
        </span>
      </button>
    </li>
  );
}
