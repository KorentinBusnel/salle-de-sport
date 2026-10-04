/**
 * Tokens de design partagés back office / mobile.
 * Palette PROVISOIRE en attendant la charte de la salle (BRIEF §11), réglée pour le
 * niveau WCAG AA : un test vérifie les contrastes des couples de `semantic`.
 */
export const colors = {
  brand: {
    50: "#fff4ed",
    100: "#ffe6d4",
    500: "#f05a1a",
    600: "#c2410c",
    700: "#b4370f",
  },
  neutral: {
    0: "#ffffff",
    50: "#f7f7f8",
    100: "#ececee",
    200: "#e4e4e7",
    300: "#c5c5cb",
    400: "#86868f",
    500: "#66666f",
    700: "#3f3f46",
    900: "#18181b",
  },
  success: "#167536",
  warning: "#a14a08",
  danger: "#c0201f",
} as const;

/**
 * Rôles des couleurs (noms shadcn/ui) : mêmes classes sur les deux apps
 * (`bg-primary`, `text-muted-foreground`, `border-input`…).
 */
export const semantic = {
  background: colors.neutral[50],
  foreground: colors.neutral[900],
  card: colors.neutral[0],
  "card-foreground": colors.neutral[900],
  popover: colors.neutral[0],
  "popover-foreground": colors.neutral[900],
  primary: colors.brand[600],
  "primary-foreground": colors.neutral[0],
  secondary: colors.neutral[100],
  "secondary-foreground": colors.neutral[900],
  muted: colors.neutral[100],
  "muted-foreground": colors.neutral[500],
  accent: colors.brand[50],
  "accent-foreground": colors.brand[700],
  destructive: colors.danger,
  border: colors.neutral[200],
  input: colors.neutral[400],
  ring: colors.brand[500],
} as const;

/** Couleur d'affichage par défaut des disciplines (surchargée par `disciplines.color`). */
export const disciplineColors = {
  crossfit: "#dc2626",
  hyrox: "#f59e0b",
  renfo: "#2563eb",
  run: "#16a34a",
} as const;

/** Back office uniquement : le mobile garde la police système (BRIEF §12). */
export const fontFamily = {
  sans: "Inter",
  display: "Inter",
} as const;

/** Échelle additive (Watermelon) : rayon externe = rayon interne + marge intérieure. */
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  "2xl": 18,
  "3xl": 22,
  "4xl": 26,
  full: 9999,
} as const;

/** Ombres en couches plutôt que bordures (web ; le mobile les passe en `style.boxShadow`). */
export const shadows = {
  border:
    "0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06), 0 2px 4px 0 rgba(0, 0, 0, 0.04)",
  "border-hover":
    "0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08), 0 4px 8px 0 rgba(0, 0, 0, 0.06)",
} as const;
