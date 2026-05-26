import js from "@eslint/js";
import globals from "globals";

const sharedRules = {
  "brace-style": ["error", "1tbs", { allowSingleLine: false }],
  curly: ["error", "all"],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-var": "error",
  "no-unused-vars": ["error", { caughtErrors: "none" }],
  "prefer-const": "error",
};

export default [
  {
    ignores: ["node_modules/**", "demo/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: globals.browser,
    },
    rules: {
      ...sharedRules,
      "no-console": "error",
    },
  },
  {
    files: ["src/dataRescue.js"],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        fetch: "readonly",
        WebSocket: "readonly",
      },
    },
    rules: {
      ...sharedRules,
      "no-console": "off",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      ...sharedRules,
      "no-console": "off",
    },
  },
];
