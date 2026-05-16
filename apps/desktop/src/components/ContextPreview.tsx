import type { ContextTrace } from "../types";

interface ContextPreviewProps {
  trace: ContextTrace | null;
}

export function ContextPreview({ trace }: ContextPreviewProps) {
  if (!trace) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Context preview</h2>
        </header>
        <p className="empty">Send a chat message to see how the compiler chose your context.</p>
      </section>
    );
  }

  return (
    <section className="panel context-preview">
      <header className="panel-header">
        <h2>Context preview</h2>
        <p className="muted">
          {trace.prompt_tokens_estimated} compiled tokens · {trace.tokens_saved_estimated} saved
        </p>
      </header>

      {trace.warnings.length > 0 && (
        <div className="warnings">
          {trace.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="trace-grid">
        <div>
          <h3>Why selected</h3>
          {trace.why_selected.length === 0 ? (
            <p className="empty">Nothing selected.</p>
          ) : (
            <ul>
              {trace.why_selected.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <span className="badge">{item.type}</span> {item.id} —{" "}
                  <span className="muted">{item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Excluded</h3>
          {trace.excluded.length === 0 ? (
            <p className="empty">Nothing excluded.</p>
          ) : (
            <ul>
              {trace.excluded.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <span className="badge badge--warn">{item.type}</span> {item.id} —{" "}
                  <span className="muted">{item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h3>Memories used</h3>
        {trace.selected_memories.length === 0 ? (
          <p className="empty">No memories selected.</p>
        ) : (
          <ul>
            {trace.selected_memories.map((memory) => (
              <li key={memory.id}>
                <strong>{memory.type}</strong> · {memory.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
