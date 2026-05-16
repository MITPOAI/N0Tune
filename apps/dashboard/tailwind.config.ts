import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16201b",
        field: "#f7f7f2",
        moss: "#47624f",
        "moss-soft": "#e3ece6",
        rust: "#a45735",
        line: "#d8d8ce",
        surface: "#ffffff",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(22, 32, 27, 0.08)",
        card: "0 1px 2px rgba(22, 32, 27, 0.06), 0 0 0 1px rgba(22, 32, 27, 0.04)",
        ring: "0 0 0 3px rgba(71, 98, 79, 0.18)",
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
