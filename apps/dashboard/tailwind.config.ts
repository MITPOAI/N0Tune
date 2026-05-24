import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-strong": "var(--surface-strong)",
        ice: "var(--ice)",
        "ice-muted": "var(--ice-muted)",
        line: "var(--line)",
        "glass-line": "var(--line)",
        field: "var(--field)",
        glass: "var(--surface)",
        memory: "var(--memory)",
        "memory-soft": "var(--memory-soft)",
        model: "var(--model)",
        "model-soft": "var(--model-soft)",
        context: "var(--context)",
        companion: "var(--companion)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        soft: "var(--shadow-soft)",
        ring: "0 0 0 3px rgba(77, 225, 210, 0.18)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.2, 0.6, 0.2, 1)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Geist Mono",
          "SFMono-Regular",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
