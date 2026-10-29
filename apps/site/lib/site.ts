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

/**
 * Témoignages réels uniquement (jamais inventés) : la section n'apparaît que si la liste est
 * remplie, avec l'accord écrit de la personne citée.
 */
export const TESTIMONIALS: readonly { quote: string; name: string; role: string }[] = [];

/** Ancres de la page d'accueil, dans l'ordre de lecture. */
export const SECTIONS = {
  top: "haut",
  features: "fonctionnalites",
  how: "comment",
  faq: "questions",
  demo: "demo",
} as const;
