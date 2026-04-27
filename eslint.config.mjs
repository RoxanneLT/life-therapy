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
