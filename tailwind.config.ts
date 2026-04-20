import type { Config } from "tailwindcss";

/**
 * v0.4 Council token namespace. Token *values* are applied to CSS
 * variables at F06 via `app/globals.css`; this config only declares the
 * Tailwind theme extension so utilities resolve to the canonical CSS
 * variables from docs/design-system/design-system.md §4, §5, §6, §7, §9.
 *
 * Canonical names only. No aliases. No legacy short names.
 * See design-system.md §11 "Naming Convention" + §11.3 "Forbidden Names".
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // §4 Color System — canonical --color-* names only.
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "surface-canvas": "var(--color-surface-canvas)",
        "surface-shelf": "var(--color-surface-shelf)",
        "surface-pressed": "var(--color-surface-pressed)",
        "surface-card": "var(--color-surface-card)",
        "ink-900": "var(--color-ink-900)",
        "ink-700": "var(--color-ink-700)",
        "ink-500": "var(--color-ink-500)",
        "border-default": "var(--color-border-default)",
        "accent-terra-700": "var(--color-accent-terra-700)",
        "accent-terra-500": "var(--color-accent-terra-500)",
        "accent-moss-700": "var(--color-accent-moss-700)",
        "accent-moss-300": "var(--color-accent-moss-300)",
        "accent-plum-700": "var(--color-accent-plum-700)",
      },
      // §5 Typography — --font-family-*, --font-size-*, --font-weight-*.
      fontFamily: {
        "family-display": ["var(--font-family-display)", "serif"],
        "family-body": ["var(--font-family-body)", "sans-serif"],
        "family-mono": ["var(--font-family-mono)", "monospace"],
      },
      fontSize: {
        "size-xs": "var(--font-size-xs)",
        "size-sm": "var(--font-size-sm)",
        "size-md": "var(--font-size-md)",
        "size-lg": "var(--font-size-lg)",
        "size-xl": "var(--font-size-xl)",
      },
      fontWeight: {
        "weight-regular": "var(--font-weight-regular)",
        "weight-medium": "var(--font-weight-medium)",
        "weight-semibold": "var(--font-weight-semibold)",
      },
      // §6 Spacing — --space-*.
      spacing: {
        "space-1": "var(--space-1)",
        "space-2": "var(--space-2)",
        "space-3": "var(--space-3)",
        "space-4": "var(--space-4)",
        "space-6": "var(--space-6)",
        "space-8": "var(--space-8)",
        "space-12": "var(--space-12)",
        "space-16": "var(--space-16)",
      },
      // §7 Surfaces And Elevation — --shadow-*, --ring-focus.
      boxShadow: {
        "card-rest": "var(--shadow-card-rest)",
        "card-hover": "var(--shadow-card-hover)",
        proposal: "var(--shadow-proposal)",
        modal: "var(--shadow-modal)",
        "ring-focus": "var(--ring-focus)",
      },
      // §9 Motion — --motion-duration-*, --motion-ease-*.
      transitionDuration: {
        "duration-fast": "var(--motion-duration-fast)",
        "duration-medium": "var(--motion-duration-medium)",
        "duration-slow": "var(--motion-duration-slow)",
      },
      transitionTimingFunction: {
        "ease-editorial": "var(--motion-ease-editorial)",
        "ease-standard": "var(--motion-ease-standard)",
      },
    },
  },
  plugins: [],
};
export default config;
