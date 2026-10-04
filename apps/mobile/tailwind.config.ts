import type { Config } from "tailwindcss";
import { colors, disciplineColors, radius, semantic } from "@salle/ui";
// @ts-expect-error nativewind/preset est un module CommonJS sans déclaration de types.
import nativewindPreset from "nativewind/preset";

// NativeWind 4 repose sur Tailwind v3 : les tokens de packages/ui sont injectés ici
// sous les mêmes noms que le thème v4 du back office (brand-600, bg-primary,
// text-muted-foreground, rounded-xl…) pour que les classes soient identiques.
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Classes de ton partagées (packages/shared/src/display.ts).
    "../../packages/shared/src/**/*.ts",
  ],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        ...colors,
        ...semantic,
        discipline: disciplineColors,
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([name, px]) => [name, `${px}px`]),
      ),
    },
  },
} satisfies Config;
