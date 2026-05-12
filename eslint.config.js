// @ts-check
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: {
      // Don't error on eslint-disable comments for rules that aren't enabled.
      // Pre-existing react-hooks disable comments remain valid without enabling the full rule set.
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // Security: ban raw @tauri-apps/api/core imports everywhere except src/bindings.ts.
      // All invoke() calls must go through the typed wrappers in src/bindings.ts.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tauri-apps/api/core",
              message:
                "Do not import from @tauri-apps/api/core directly. Use the typed wrappers in src/bindings.ts instead.",
            },
          ],
        },
      ],
    },
  },
  // Allow src/bindings.ts to import from @tauri-apps/api/core — it IS the typed wrapper layer.
  {
    files: ["src/bindings.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src-tauri/**"],
  },
];
