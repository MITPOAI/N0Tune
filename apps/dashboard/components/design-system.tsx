import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "planned";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClass: Record<Tone, string> = {
  neutral: "border-glass-line bg-glass text-ice",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-danger/35 bg-danger/10 text-danger",
  info: "border-memory/35 bg-memory/10 text-memory",
  planned: "border-model/35 bg-model/10 text-model-soft",
};

export function GlassCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={cx(
        "glass-card",
        interactive && "glass-card--interactive",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <GlassCard className="p-4">
      <p className="label-text">{label}</p>
      <p
        className={cx(
          "mt-2 text-3xl font-semibold tabular-nums",
          toneText(tone),
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 text-sm text-ice-muted">{detail}</p> : null}
    </GlassCard>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {dot ? (
        <span className={cx("h-2 w-2 rounded-full", toneDot(tone))} />
      ) : null}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-glass-line bg-white/[0.04] p-6 text-center">
      <p className="font-semibold text-ice">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ice-muted">
        {body}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton h-12" key={index} />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something needs attention",
  body,
}: {
  title?: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-danger/35 bg-danger/10 p-4 text-sm text-danger">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 break-words leading-6">{body}</p>
    </div>
  );
}

export function SectionHeader({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight text-ice">
          {title}
        </h2>
        {body ? (
          <p className="mt-2 text-sm leading-6 text-ice-muted">{body}</p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function TokenSavingsMeter({
  compiled,
  saved,
}: {
  compiled: number;
  saved: number;
}) {
  const naive = Math.max(compiled + saved, 1);
  const pct = Math.max(0, Math.min(100, Math.round((saved / naive) * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="label-text">Context savings</p>
          <p className="mt-2 text-4xl font-semibold text-memory tabular-nums">
            {pct}%
          </p>
        </div>
        <div className="text-right text-sm text-ice-muted">
          <p>Compiled {compiled.toLocaleString()}</p>
          <p>Saved {saved.toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-memory to-model"
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>
    </div>
  );
}

function toneText(tone: Tone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "info") return "text-memory";
  if (tone === "planned") return "text-model-soft";
  return "text-ice";
}

function toneDot(tone: Tone) {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "info") return "bg-memory";
  if (tone === "planned") return "bg-model";
  return "bg-ice-muted";
}
