import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16201b",
        field: "#f7f7f2",
        moss: "#47624f",
        rust: "#a45735",
        line: "#d8d8ce",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(22, 32, 27, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
