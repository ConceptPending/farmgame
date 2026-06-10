import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    // Generated / build output — never lint these.
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        // Node globals everywhere; browser globals are scoped to the packages
        // that actually run in a browser (below) so the engine can't silently
        // grow a `window` dependency.
        ...globals.node,
      },
    },
    rules: {
      // Allow intentionally-unused args/vars when prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The codebase uses a few `as SpriteKey` template-literal casts; keep these as warnings.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["packages/renderer/**/*.ts", "apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Engine purity guards. The engine must stay deterministic and
    // environment-free: no DOM, no UI frameworks, no wall-clock time, and no
    // in-place mutation of state reached through function parameters — the
    // two silent determinism killers CLAUDE.md warns about.
    files: ["packages/engine/src/**/*.ts"],
    rules: {
      "no-param-reassign": ["error", { props: true }],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "The engine is environment-free — no DOM." },
        { name: "document", message: "The engine is environment-free — no DOM." },
        { name: "localStorage", message: "The engine does no I/O — persistence lives in apps/web." },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "The engine must not depend on React." },
            { name: "pixi.js", message: "The engine must not depend on Pixi." },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message:
            "Date.now() breaks determinism. The only sanctioned use is the default seed in createGameState (state.ts), which carries a local disable.",
        },
        {
          object: "Math",
          property: "random",
          message: "Use the seeded RNG (src/rng.ts) — Math.random() breaks determinism.",
        },
      ],
    },
  },
  {
    // React hooks discipline for the web app (rules-of-hooks violations
    // white-screen the app at runtime; exhaustive-deps stays a warning since
    // juice-hooks documents deliberate dep omissions).
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
