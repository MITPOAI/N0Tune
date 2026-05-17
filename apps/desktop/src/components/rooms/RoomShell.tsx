import type { ReactNode } from "react";

interface RoomShellProps {
  icon: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Common chrome for every room. Header strip with the room's icon +
 * name + a one-line subtitle, then the body. The icon doubles as the
 * sidebar's mansion-door affordance so the user always knows which
 * room they're standing in.
 */
export function RoomShell({
  icon,
  title,
  subtitle,
  actions,
  children,
}: RoomShellProps) {
  return (
    <section className="room">
      <header className="room-header">
        <h1 className="room-title">
          <span className="room-icon" aria-hidden>
            {icon}
          </span>
          <span>{title}</span>
        </h1>
        {subtitle ? <p className="room-subtitle">{subtitle}</p> : null}
        {actions ? <div className="room-actions">{actions}</div> : null}
      </header>
      <div className="room-body">{children}</div>
    </section>
  );
}
