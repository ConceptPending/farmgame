import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The balance suites run dozens of full multi-year simulations per test —
    // ~2-4s locally but up to ~20s on slower CI runners, past vitest's 5s
    // default. They're deterministic, so a generous ceiling only guards
    // against true hangs.
    testTimeout: 60_000,
  },
});
