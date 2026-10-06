/**
 * Tokens de design de la landing (LANDING_BRIEF.md §3, style « warm stone », action indigo).
 * Identité de la plateforme, distincte de la charte provisoire de la salle (`packages/ui`).
 * `app/globals.css` les reflète dans `@theme` : un test vérifie la concordance et les contrastes.
 */
export const colors = {
  /** Fond de page. */
  background: "#fafaf9",
  /** Texte principal, et fond des cartes sombres (assistant). */
  foreground: "#292524",
  card: "#ffffff",
  border: "#e7e5e4",
  /** Pistes des barres, fond de la barre de progression. */
  muted: "#f5f5f4",
  /** Texte secondaire. */
  "muted-foreground": "#79716b",
  /** Texte tertiaire : sur fond sombre uniquement (2,6:1 sur fond clair). */
  faint: "#a6a09b",
  /** Couleur d'action unique. */
  primary: "#615fff",
  "primary-hover": "#4f39f6",
  "primary-foreground": "#ffffff",
  /** Décoratif : traits, icônes, contours (jamais du texte). */
  terracotta: "#d97757",
  /** Contours de statut uniquement. */
  success: "#5ea500",
  info: "#22b8cd",
  /** Base du voile sur la photo du hero. */
  night: "#0c0a09",
} as const;

export type ColorToken = keyof typeof colors;
