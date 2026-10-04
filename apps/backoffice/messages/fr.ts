// Textes de l'interface. Toute chaîne affichée passe par une clé (i18n prévue, BRIEF §10.8).
export const fr = {
  app: {
    title: "Back office",
  },
  login: {
    title: "Connexion",
    subtitle: "Espace de l'équipe : gérants, coachs et accueil.",
    email: "Adresse email",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion…",
    invalidInput: "Saisissez une adresse email et un mot de passe.",
    invalidCredentials: "Adresse email ou mot de passe incorrect.",
  },
  nav: {
    signOut: "Se déconnecter",
  },
  roles: {
    member: "Adhérent",
    coach: "Coach",
    staff: "Accueil",
    manager: "Gérant",
    admin: "Admin",
  },
  noAccess: {
    title: "Accès réservé à l'équipe",
    body: "Ce compte n'a pas de rôle d'équipe dans une salle. Les adhérents utilisent l'app mobile.",
  },
  dashboard: {
    sessionsToday: "Séances du jour",
    noSessions: "Aucune séance aujourd'hui.",
    bookingsToday: "Réservations du jour",
    fillRate: "Remplissage du jour",
    activeMembers: "Adhérents actifs",
    failedPayments: "Paiements échoués (30 jours)",
    cancelled: "Annulée",
    places: "{booked} / {capacity}",
    waitlist: "+{count} en attente",
    notYourClass: "Cours d'un autre coach",
    loadError: "Impossible de charger les données. Réessayez dans un instant.",
  },
} as const;
