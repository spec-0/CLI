// ESLint v9 flat config.
// Conservative starter ruleset: TypeScript recommended + a handful of CLI-flavoured
// rules. Tightens incrementally as the codebase matures (see ROADMAP.md).

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: ["dist/", "node_modules/", "src/types.ts", "test/.jest-home/", "openapi-spec/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // CLI conventions.
      "no-console": "off",
      "no-process-exit": "off",

      // TypeScript pragmatics — relax until the codebase catches up.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests run on Jest with implicit globals.
    files: ["test/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Build scripts allowed to be more permissive.
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
