import type { Config } from "tailwindcss";

/**
 * v0.4 Council token namespace. Actual token *values* are applied to CSS
 * variables at F06 via `app/globals.css`; this config only declares the
 * namespace so Tailwind utilities like `bg-color-surface`, `p-space-3`,
 * `font-display`, `shadow-proposal`, `duration-motion-standard` resolve.
 * See docs/design-system/design-system.md.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "color-surface": "var(--color-surface)",
        "color-surface-shelf": "var(--color-surface-shelf)",
        "color-ink-500": "var(--color-ink-500)",
        "color-ink-900": "var(--color-ink-900)",
        "color-moss": "var(--color-moss)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      spacing: {
        "space-1": "var(--space-1)",
        "space-2": "var(--space-2)",
        "space-3": "var(--space-3)",
        "space-4": "var(--space-4)",
        "space-6": "var(--space-6)",
        "space-8": "var(--space-8)",
      },
      boxShadow: {
        "shadow-card": "var(--shadow-card)",
        "shadow-proposal": "var(--shadow-proposal)",
      },
      transitionTimingFunction: {
        "motion-standard": "var(--motion-ease-standard)",
      },
      transitionDuration: {
        "motion-standard": "var(--motion-duration-standard)",
      },
    },
  },
  plugins: [],
};
export default config;
