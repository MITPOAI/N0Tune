import { useState } from "react";

import type { Persona, ProviderConfig, ProviderId } from "../types";

const PROVIDER_PRESETS: ProviderConfig[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic Claude", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-pro" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
  { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.1:8b-instruct" },
  { id: "lmstudio", label: "LM Studio (local)", baseUrl: "http://localhost:1234/v1", model: "local-model" },
  { id: "compatible", label: "Custom OpenAI-compatible", baseUrl: "https://api.example.com/v1", model: "your-model" },
];

interface OnboardingProps {
  persona: Persona | null;
  onComplete: (input: { persona?: Partial<Persona>; provider: ProviderConfig }) => Promise<void>;
}

export function Onboarding({ persona, onComplete }: OnboardingProps) {
  const [name, setName] = useState(persona?.name ?? "Milo");
  const [personality, setPersonality] = useState(
    persona?.personality ?? "Friendly, terse, and honest. Cites sources when it matters.",
  );
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const preset = PROVIDER_PRESETS.find((entry) => entry.id === providerId) ?? PROVIDER_PRESETS[0];
  const [baseUrl, setBaseUrl] = useState(preset.baseUrl);
  const [model, setModel] = useState(preset.model);

  function handleProviderChange(next: ProviderId) {
    const nextPreset = PROVIDER_PRESETS.find((entry) => entry.id === next) ?? PROVIDER_PRESETS[0];
    setProviderId(next);
    setBaseUrl(nextPreset.baseUrl);
    setModel(nextPreset.model);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onComplete({
        persona: { name, personality },
        provider: {
          id: providerId,
          label: preset.label,
          baseUrl,
          model,
          apiKey: apiKey || undefined,
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding">
      <img src="/logo.png" alt="" className="onboarding-logo" />
      <h1 className="onboarding-title">Set up your personal AI</h1>
      <p className="onboarding-sub">
        N0Tune doesn’t train the model. It adds local memory, style, and
        context around any provider you choose.
      </p>

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <h2>Your AI</h2>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Personality
            <textarea
              rows={2}
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
            />
          </label>
        </section>

        <section className="form-section">
          <h2>Model provider</h2>
          <label>
            Provider
            <select
              value={providerId}
              onChange={(event) => handleProviderChange(event.target.value as ProviderId)}
            >
              {PROVIDER_PRESETS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base URL
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              required
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              required
            />
          </label>
          <label>
            API key (stored in the OS keychain on signed builds; in-memory only here)
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder="leave blank for local providers like Ollama"
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
        </section>

        <div className="form-actions">
          <button type="submit" disabled={submitting} className="primary">
            {submitting ? "Saving…" : "Open N0Tune"}
          </button>
        </div>
      </form>
    </div>
  );
}
