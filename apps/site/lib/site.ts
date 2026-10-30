/** Nom du produit (provisoire, BRIEF §11) : un seul endroit à changer. */
export const BRAND = { name: "Chalk" } as const;

/**
 * Mentions légales (LCEN, art. 6) : à compléter avant la mise en ligne ; le site n'est indexé
 * qu'en production (app/robots.ts). `null` s'affiche « à compléter » ; `false` masque une ligne
 * sans objet pour le statut (entrepreneur individuel : ni capital ni RCS ; franchise de TVA :
 * pas de numéro de TVA).
 */
export const LEGAL: Record<
  | "company"
  | "legalForm"
  | "capital"
  | "address"
  | "siren"
  | "rcs"
  | "vat"
  | "director"
  | "contactEmail"
  | "phone"
  | "hostPhone",
  string | null | false
> = {
  /** Raison sociale, ou nom et prénom d'un entrepreneur individuel. */
  company: null,
  /** SAS, SARL, entrepreneur individuel… */
  legalForm: null,
  /** Capital social d'une société (« 1 000 € »). */
  capital: null,
  /** Siège social ou adresse de domiciliation. */
  address: null,
  siren: null,
  /** Immatriculation (« RCS Lyon »). */
  rcs: null,
  /** Numéro de TVA intracommunautaire. */
  vat: null,
  /** Directeur de la publication, en général le dirigeant. */
  director: null,
  /** Contact de l'éditeur et adresse d'exercice des droits (politique de confidentialité). */
  contactEmail: null,
  phone: null,
  /** Téléphone de l'hébergeur (Vercel), exigé par la LCEN. */
  hostPhone: null,
};

/** Le compteur de salles du hero n'apparaît qu'à partir de ce nombre (BRIEF §12, 2026-10-30). */
export const GYM_COUNT_MIN = 10;

/** Ancres de la page d'accueil, dans l'ordre de lecture. */
export const SECTIONS = {
  top: "haut",
  features: "fonctionnalites",
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
