import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-warm": "var(--paper-warm)",
        "paper-deep": "var(--paper-deep)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-muted": "var(--ink-muted)",
        rule: "var(--rule)",
        terra: "var(--terra)",
        "terra-soft": "var(--terra-soft)",
        moss: "var(--moss)",
        plum: "var(--plum)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
