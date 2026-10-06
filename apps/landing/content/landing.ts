/**
 * Contenu de la landing de lancement, en un seul endroit (LANDING_BRIEF.md §2) : la page, les
 * métadonnées, le JSON-LD, /llms.txt et l'image Open Graph le lisent ici, pour qu'un fait (nom,
 * prix, date) ne soit écrit qu'une fois. Vouvoiement partout.
 *
 * Règle : rien qui ne soit vrai au lancement (pas de faux chiffres clients, pas d'avis).
 * Les chiffres de l'aperçu illustrent l'interface : ce sont des données de démonstration.
 */

export const brand = {
  name: "Kettl",
  /** Logo typographique : le nom en minuscules suivi d'un point en couleur d'action. */
  wordmark: "kettl",
  domain: "kettl.ai",
  contactEmail: "contact@kettl.ai",
} as const;

export const pricing = {
  label: "Tarif fondateur",
  amount: 99,
  currency: "EUR",
  display: "99 €",
  period: "/ mois",
  audience: "pour les premières salles inscrites",
} as const;

export const launch = {
  /** Date annoncée publiquement. */
  label: "début 2027",
} as const;

export const seo = {
  /** ≤ 60 caractères (test). */
  title: `${brand.name} — Logiciel de gestion de salle de sport avec IA`,
  /** ≤ 155 caractères (test). */
  description:
    "Planning, réservations, paiements, CRM et marketplace réunis, avec un assistant IA. Tarif fondateur 99 €/mois. Rejoignez la liste d'attente.",
  /** Résumé d'une phrase (llms.txt, JSON-LD). */
  summary: `${brand.name} est un logiciel français de gestion de salle de sport assisté par l'intelligence artificielle, pour les salles indépendantes (CrossFit, Hyrox, renforcement, running, studios).`,
  ogAlt: `${brand.name} — Votre salle de sport, augmentée par l'IA. Tarif fondateur : 99 € par mois.`,
} as const;

export const header = {
  homeLabel: `${brand.name} — accueil`,
  join: "Rejoindre",
} as const;

export const hero = {
  badge: "Plusieurs salles déjà sur liste d'attente",
  /** Version courte sur mobile (maquette « Hero — mobile »). */
  badgeShort: "Plusieurs salles en liste d'attente",
  title: { before: "Votre salle de sport, ", emphasis: "augmentée", after: " par l'IA." },
  subtitle:
    "Optimisez la gestion de votre salle grâce à l'intelligence artificielle, pour vous concentrer là où ça compte.",
  photoAlt: "Athlète sur un rameur dans une salle de sport baignée de lumière",
} as const;

export const form = {
  emailLabel: "Votre email professionnel",
  placeholder: "contact@votre-salle.fr",
  submit: { hero: "Rejoindre la liste", final: "Je m'inscris" },
  pending: "Envoi…",
  /** Texte exact enregistré avec l'inscription (preuve du consentement). */
  consent: `J'accepte de recevoir des informations sur le lancement de ${brand.name}.`,
  privacyLink: "Confidentialité",
  success: {
    hero: "C'est noté ! Vérifiez votre boîte mail, nous revenons vers vous avant le lancement.",
    final: "Vous êtes sur la liste. À très vite !",
  },
  already: "Cette adresse est déjà sur la liste : nous vous écrirons avant le lancement.",
  errors: {
    email: "Saisissez une adresse email valide.",
    consent: "Cochez la case pour recevoir les informations du lancement.",
    rate_limited: "Trop de tentatives depuis votre connexion. Réessayez dans une heure.",
    generic: `L'inscription n'a pas abouti. Réessayez dans un instant ou écrivez-nous à ${brand.contactEmail}.`,
  },
} as const;

// ---------------------------------------------------------------------------
// Aperçu interactif du logiciel (§2.3)
// ---------------------------------------------------------------------------

export type StepId =
  "quotidien" | "dashboard" | "operations" | "crm" | "marketplace" | "integrations";

export type Step = {
  id: StepId;
  /** Numéro affiché (absent pour Intégrations). */
  num: string | null;
  label: string;
  /** Sous-rubriques affichées sous l'étape active. */
  items: string | null;
  subtitle: string;
};

/** Statut d'une ligne : contour coloré (vert et teal en contour uniquement). */
export type Tone = "terracotta" | "success" | "info";

export const preview = {
  label: `Aperçu du logiciel ${brand.name}`,
  navTitle: "Pilotage de votre salle",
  navHint: "Cliquez sur une étape pour l'explorer",
  live: { prefix: "En direct", suffix: "check-ins aujourd'hui", initial: 37 },
  steps: [
    {
      id: "quotidien",
      num: "01",
      label: "Quotidien",
      items: "Cours du jour · Check-in · Messages",
      subtitle: "Ce qui se passe aujourd'hui",
    },
    {
      id: "dashboard",
      num: "02",
      label: "Dashboard",
      items: "KPIs · Tendances · Alertes",
      subtitle: "La santé de votre salle en un coup d'œil",
    },
    {
      id: "operations",
      num: "03",
      label: "Opérations",
      items: "Planning · Coachs · Paiements",
      subtitle: "Planning, coachs et encaissements",
    },
    {
      id: "crm",
      num: "04",
      label: "CRM",
      items: "Adhérents · Segments · Campagnes",
      subtitle: "Chaque adhérent, chaque échange",
    },
    {
      id: "marketplace",
      num: "05",
      label: "Marketplace",
      items: "Produits · Services · Devis",
      subtitle: "Commande produits et services",
    },
    {
      id: "integrations",
      num: null,
      label: "Intégrations",
      items: null,
      subtitle: "6 outils connectés, synchronisés automatiquement",
    },
  ] satisfies Step[],

  quotidien: {
    classesTitle: "Cours du jour",
    classes: [
      { time: "07:00", discipline: "CrossFit", booked: 12, capacity: 12, waiting: 0 },
      { time: "12:30", discipline: "Renfo", booked: 6, capacity: 14, waiting: 0 },
      { time: "19:00", discipline: "Hyrox", booked: 16, capacity: 16, waiting: 3 },
    ],
    waitingSuffix: "en attente",
    inboxTitle: "À traiter",
    inbox: [
      { channel: "WhatsApp", count: 3, highlight: true },
      { channel: "Gmail", count: 2, highlight: false },
    ],
    assistantLabel: "Assistant",
    assistantMessage:
      "Une place s'est libérée à 19:00. Je préviens le premier de la liste d'attente ?",
    assistantAction: "Prévenir",
  },

  dashboard: {
    fill: { label: "Remplissage", value: "82 %" },
    active: { label: "Adhérents actifs", value: "248", trend: "ce mois" },
    churn: { label: "Risque de départ", value: "7", tag: "À relancer" },
    emails: { label: "Emails prioritaires", value: "5", tag: "À répondre" },
    assistantMessage:
      "Le cours de 12:30 perd 4 habitués depuis 3 semaines. Je prépare un message pour chacun ?",
    assistantAction: "Préparer",
  },

  operations: {
    planningTitle: "Planning de la semaine",
    days: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    /** Deux créneaux par jour ; `null` = coach à remplacer. */
    slots: [
      ["CrossFit", "Hyrox", "CrossFit", "Run", "CrossFit"],
      ["Renfo", null, "Renfo", "Hyrox", "Renfo"],
    ],
    replaceCoach: "Coach à remplacer",
    failedPayments: { label: "Paiements échoués", value: "2", note: "Relance automatique envoyée" },
    coachHours: { label: "Heures coachs", value: "86 h", note: "Export paie prêt" },
  },

  crm: {
    filters: ["Tous", "Inactifs 21 j · 7", "Fin d'engagement · 4", "Prospects · 12"],
    columns: ["Adhérent", "Statut", "Dernier échange"],
    rows: [
      { name: "Camille R.", status: "À relancer", tone: "terracotta", last: "WhatsApp · 23 j" },
      { name: "Thomas L.", status: "Actif", tone: "success", last: "Gmail · hier" },
      { name: "Inès M.", status: "Essai", tone: "info", last: "Appel · 2 j" },
    ] satisfies { name: string; status: string; tone: Tone; last: string }[],
  },

  marketplace: {
    restockTitle: "Réassort rapide",
    restock: [
      { item: "Boissons isotoniques · carton de 24", quantity: 4 },
      { item: "Whey vanille · pot de 2 kg", quantity: 2 },
      { item: "Serviettes microfibre · lot de 50", quantity: 1 },
    ],
    reorder: "Commander à nouveau",
    cleaning: { label: "Service · Ménage", value: "2 devis reçus", note: "À comparer" },
    merch: { label: "T-shirts au logo", value: "BAT à valider", tag: "Valider" },
  },

  integrations: {
    status: "Connecté",
    tools: [
      {
        initials: "St",
        name: "Stripe",
        description: "Abonnements, paiements CB et SEPA, relance des impayés",
      },
      {
        initials: "Pl",
        name: "Pennylane",
        description: "Factures, charges et trésorerie synchronisées avec votre compta",
      },
      {
        initials: "Gl",
        name: "Gymlib",
        description: "Réservations des salariés venus via leur pass sport entreprise",
      },
      {
        initials: "Gm",
        name: "Gmail",
        description: "Emails des adhérents et prospects rattachés à leur fiche",
      },
      {
        initials: "Wa",
        name: "WhatsApp",
        description: "Messages entrants et relances depuis la plateforme",
      },
      {
        initials: "Ga",
        name: "Google Agenda",
        description: "Planning des cours et des coachs synchronisé",
      },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Rappel final (§2.4), FAQ (§2.5), pied de page (§2.6)
// ---------------------------------------------------------------------------

export const finalCta = {
  eyebrow: "Tarif fondateur",
  title: { before: "Prenez votre place ", emphasis: "avant", after: " le lancement." },
  price: `${pricing.display} / mois`,
  text: " pour les premières salles inscrites. Plusieurs salles ont déjà rejoint la liste.",
} as const;

/**
 * Questions fréquentes : affichées telles quelles et reprises mot pour mot dans le JSON-LD
 * (FAQPage) et /llms.txt. Pas de question sur les intégrations (BRIEF §12, 2026-10-06).
 */
export const faq = {
  title: "Questions fréquentes",
  items: [
    {
      question: `Qu'est-ce que ${brand.name} ?`,
      answer: `${brand.name} est un logiciel français de gestion de salle de sport, assisté par l'intelligence artificielle. Il réunit le planning et la réservation de cours, les paiements et le suivi des adhérents (CRM), ainsi qu'une marketplace pour les achats de la salle.`,
    },
    {
      question: `Pour quelles salles ${brand.name} est-il conçu ?`,
      answer: `${brand.name} s'adresse aux salles indépendantes en France : box CrossFit, salles Hyrox, salles de renforcement, clubs de running et studios indépendants.`,
    },
    {
      question: `Combien coûte ${brand.name} ?`,
      answer: `Le tarif fondateur est de ${pricing.display} par mois pour les premières salles inscrites sur la liste d'attente.`,
    },
    {
      question: `Quand ${brand.name} sera-t-il disponible ?`,
      answer: `Le lancement est prévu ${launch.label}. Les salles inscrites sur la liste d'attente auront un accès prioritaire.`,
    },
  ],
} as const;

export const footer = {
  contact: "Contact →",
  legal: "Mentions légales",
  privacy: "Confidentialité",
} as const;

export const notFound = {
  title: "Page introuvable",
  text: "Cette page n'existe pas ou a été déplacée.",
  back: "Retour à l'accueil",
} as const;
