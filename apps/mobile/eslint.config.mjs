import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  ...expoConfig,
  {
    // eslint-plugin-react 7.x ne sait pas détecter la version de React sous ESLint 10
    // (API context.getFilename retirée) : version indiquée explicitement.
    settings: { react: { version: "19.2" } },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  globalIgnores([".expo/**", "dist/**", "expo-env.d.ts"]),
]);
