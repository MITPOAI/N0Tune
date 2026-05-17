import type { Config } from "tailwindcss";

/**
 * Tailwind theme bound to the CSS-variable design tokens in
 * `app/globals.css`. The tokens are the source of truth; this file
 * just gives Tailwind classnames that read from them so dark mode +
 * theme tweaks happen in one place.
 *
 * Token semantics (mirror of apps/desktop/src/styles.css):
 *
 *   --bg          Canvas behind everything.
 *   --surface     Cards / panels / inputs while focused.
 *   --field       Subtle filled inputs / chips.
 *   --line        Borders and dividers.
 *   --ink         Primary text / strong glyphs.
 *   --ink-mute    Secondary text.
 *   --accent      Primary action / focus rings / links.
 *   --accent-soft Halo behind focus rings.
 *   --warn        Warning + destructive intent.
 *   --warn-soft   Warning background fill.
 *   --warn-line   Warning border.
 *
 * Legacy alias names (`moss`, `rust`, etc.) are kept until existing
 * components migrate so we don't break the diff in one pass.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canonical, CSS-var-backed semantic tokens.
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        "ink-mute": "var(--ink-mute)",
        line: "var(--line)",
        field: "var(--field)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        "warn-line": "var(--warn-line)",
        // Legacy aliases kept so existing classes keep rendering during
        // the gradual migration. New code should prefer the semantic
        // tokens above.
        moss: "var(--accent)",
        "moss-soft": "var(--accent-soft)",
        rust: "var(--warn)",
      },
      boxShadow: {
        panel: "var(--shadow)",
        card: "var(--shadow)",
        ring: "0 0 0 3px var(--accent-soft)",
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
      },
    },
  },
  plugins: [],
};

export default config;
