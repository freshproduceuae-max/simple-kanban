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
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**", "**/dist/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
