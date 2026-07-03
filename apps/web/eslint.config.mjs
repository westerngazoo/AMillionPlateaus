// Flat ESLint config for the vanilla-JS web client (apps/web/src).
// Intentionally light: no framework, ES modules, browser + node (test) globals.
// The goal is a cheap CI gate for real bugs — not a style rewrite. Prettier owns
// formatting; ESLint stays out of formatting concerns.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    // Generated / vendored / data — never our source to lint.
    ignores: ["pkg/**", "vendor/**", "export/**", "sw.js"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Unused vars are a smell, not a build-breaker here; allow _-prefixed and
      // unused function args (common in event handlers / callback signatures).
      "no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // Sanitizers legitimately match control chars (e.g. stripping \x00 from
      // imported markdown). Not a bug here — keep it off rather than churn source.
      "no-control-regex": "off",
    },
  },
];
