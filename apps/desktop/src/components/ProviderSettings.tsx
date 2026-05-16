import { useEffect, useState } from "react";

import type { ProviderConfig, ProviderId } from "../types";

const PROVIDER_PRESETS: ProviderConfig[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic Claude", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-pro" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
  { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.1:8b-instruct" },
  { id: "lmstudio", label: "LM Studio (local)", baseUrl: "http://localhost:1234/v1", model: "local-model" },
  { id: "compatible", label: "Custom OpenAI-compatible", baseUrl: "https://api.example.com/v1", model: "your-model" },
];

interface ProviderSettingsProps {
  provider: ProviderConfig | null;
  onSave: (next: ProviderConfig) => Promise<void>;
}

export function ProviderSettings({ provider, onSave }: ProviderSettingsProps) {
  const [providerId, setProviderId] = useState<ProviderId>(provider?.id ?? "openai");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? PROVIDER_PRESETS[0].baseUrl);
  const [model, setModel] = useState(provider?.model ?? PROVIDER_PRESETS[0].model);
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? "");

  useEffect(() => {
    if (!provider) return;
    setProviderId(provider.id);
    setBaseUrl(provider.baseUrl);
    setModel(provider.model);
    setApiKey(provider.apiKey ?? "");
  }, [provider]);

  function handleProviderChange(next: ProviderId) {
    const preset = PROVIDER_PRESETS.find((entry) => entry.id === next) ?? PROVIDER_PRESETS[0];
    setProviderId(next);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const preset = PROVIDER_PRESETS.find((entry) => entry.id === providerId) ?? PROVIDER_PRESETS[0];
    await onSave({
      id: providerId,
      label: preset.label,
      baseUrl,
      model,
      apiKey: apiKey || undefined,
    });
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Model provider</h2>
        <p className="muted">
          N0Tune doesn’t host models. Pick a provider, give it a key (or a local URL).
        </p>
      </header>

      <form className="settings-form" onSubmit={handleSave}>
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
            value={model}
            onChange={(event) => setModel(event.target.value)}
            required
          />
        </label>
        <label>
          API key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="leave blank for Ollama / LM Studio"
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary">
            Save provider
          </button>
        </div>
      </form>
    </section>
  );
}
