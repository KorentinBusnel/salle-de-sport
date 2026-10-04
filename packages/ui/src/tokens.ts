/**
 * Tokens de design partagés back office / mobile.
 * Palette PROVISOIRE en attendant la charte de la salle (BRIEF §11).
 */
export const colors = {
  brand: {
    50: "#fff4ed",
    100: "#ffe6d4",
    500: "#f05a1a",
    600: "#d94710",
    700: "#b4370f",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f7f8",
    100: "#ececee",
    300: "#c5c5cb",
    500: "#7a7a85",
    700: "#3f3f46",
    900: "#18181b",
  },
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
} as const;

/** Couleur d'affichage par défaut des disciplines (surchargée par `disciplines.color`). */
export const disciplineColors = {
  crossfit: "#dc2626",
  hyrox: "#f59e0b",
  renfo: "#2563eb",
  run: "#16a34a",
} as const;

export const fontFamily = {
  sans: "Inter",
  display: "Inter",
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;
