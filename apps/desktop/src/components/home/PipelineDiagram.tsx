interface PipelineDiagramProps {
  stage: "idle" | "embed" | "retrieve" | "compile" | "call" | "cache";
}

const STAGES = [
  { key: "embed", label: "embed", hint: "text → vector" },
  { key: "retrieve", label: "retrieve", hint: "memory + chunks" },
  { key: "compile", label: "compile", hint: "fit token budget" },
  { key: "call", label: "call", hint: "your provider" },
] as const;

/**
 * Animated SVG of the N0Tune pipeline. Each stage lights up as the
 * last chat passes through it. Visualization, not telemetry — the
 * "what does this system actually do?" answer in one screen.
 *
 *   message ──▶ embed ──▶ retrieve ──▶ compile ──▶ provider
 *                  │                      ▲
 *                  └──▶  cache  ──────────┘  (hit branch)
 */
export function PipelineDiagram({ stage }: PipelineDiagramProps) {
  return (
    <section className="pipeline" aria-label="N0Tune request pipeline">
      <header>
        <span className="muted small">Per-request flow</span>
      </header>
      <ol className="pipeline-stages">
        <Node label="message" hint="your prompt" status="source" />
        {STAGES.map(({ key, label, hint }) => (
          <Node
            key={key}
            label={label}
            hint={hint}
            status={stage === key ? "active" : "default"}
          />
        ))}
        <Node label="answer" hint="back to you" status="sink" />
      </ol>
      <p className="muted small pipeline-caption">
        Same model. Different prompt. Personal answer. Each step adds
        memory or shrinks the context — never extra tokens.
      </p>
    </section>
  );
}

interface NodeProps {
  label: string;
  hint: string;
  status: "default" | "active" | "source" | "sink";
}

function Node({ label, hint, status }: NodeProps) {
  return (
    <li className={`pipeline-node pipeline-node--${status}`}>
      <span className="pipeline-node-dot" aria-hidden />
      <span className="pipeline-node-label">{label}</span>
      <span className="pipeline-node-hint">{hint}</span>
    </li>
  );
}
