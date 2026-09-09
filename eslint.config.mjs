import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // WRITTEN HERE RATHER THAN INHERITED, and the reason is ownership, not style.
      // `next/typescript` already sets this, so the rule was in force and the gate was
      // green — but CLAUDE.md's §4 claims it as this project's own rule under
      // `@enforced eslint:@typescript-eslint/no-explicit-any`, and nothing in this repo
      // held it. The day the preset changes its mind, the claim goes on reading as true
      // with nothing behind it, which is the exact overclaim the @enforced markers exist
      // to prevent. A preset is a dependency; a rule this file names is a decision.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      // New React 19 strict rules — set-state-in-effect over-fires on valid
      // async-load and conditional-reset patterns; disable until upstream improves.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: ["next-env.d.ts", "prisma/**", "lib/generated/**"],
  },
];

export default eslintConfig;
