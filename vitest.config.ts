import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // `.claude/worktrees/**` holds git worktrees created by the Agent
    // tool for isolated subagent runs. They're gitignored but vitest
    // would otherwise pick up their stale test files.
    // "CV Master", "CPTO Case Studies", and "Widsom for AI" are
    // untracked personal folders that happen to sit inside this repo's
    // root (not part of the project) — one of them contains a stale
    // duplicate copy of parts of this app that would otherwise run
    // (and fail) here too. See the matching exclude in tsconfig.json.
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
      "**/dist/**",
      "CV Master/**",
      "CPTO Case Studies/**",
      "Widsom for AI/**",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
