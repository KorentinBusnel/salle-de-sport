import type { Config } from "tailwindcss";
import { colors, disciplineColors, radius } from "@salle/ui";
// @ts-expect-error nativewind/preset est un module CommonJS sans déclaration de types.
import nativewindPreset from "nativewind/preset";

// NativeWind 4 repose sur Tailwind v3 : les tokens de packages/ui sont injectés ici
// sous les mêmes noms que le thème v4 du back office (brand-600, neutral-900…).
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        ...colors,
        discipline: disciplineColors,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
      },
    },
  },
} satisfies Config;
