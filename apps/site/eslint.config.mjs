import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react 7.x ne sait pas détecter la version de React sous ESLint 10
    // (API context.getFilename retirée) : version indiquée explicitement.
    settings: { react: { version: "19.3" } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
