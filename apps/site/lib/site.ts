/** Nom du produit (provisoire, BRIEF §11) : un seul endroit à changer. */
export const BRAND = { name: "Chalk" } as const;

/**
 * Mentions légales : à compléter avant la mise en ligne. Une valeur `null` s'affiche
 * « à compléter » ; le site n'est indexé qu'en production (app/robots.ts).
 */
export const LEGAL: Record<
  "company" | "address" | "siren" | "director" | "contactEmail",
  string | null
> = {
  company: null,
  address: null,
  siren: null,
  director: null,
  contactEmail: null,
};

/** Le compteur de salles du hero n'apparaît qu'à partir de ce nombre (BRIEF §12, 2026-10-30). */
export const GYM_COUNT_MIN = 10;

/** Ancres de la page d'accueil, dans l'ordre de lecture. */
export const SECTIONS = {
  top: "haut",
  adaptable: "toutes-les-salles",
  features: "fonctionnalites",
  how: "comment",
  faq: "questions",
  start: "demarrer",
  contact: "contact",
} as const;

/** Ancres des fonctionnalités, l'IA en premier (la pastille du hero vise la première). */
export const FEATURES = {
  assistant: "fonction-ia",
  classes: "fonction-cours",
  payments: "fonction-paiements",
  members: "fonction-adherents",
  coaches: "fonction-coachs",
} as const;
