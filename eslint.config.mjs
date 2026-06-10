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
        ...globals.browser,
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
