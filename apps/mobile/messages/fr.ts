// Textes de l'app. Toute chaîne affichée passe par une clé (i18n prévue, BRIEF §10.8).
export const fr = {
  planning: {
    title: "Planning",
    subtitle: "Les 7 prochains jours",
    empty: "Aucune séance prévue cette semaine.",
    loadError: "Impossible de charger le planning. Vérifiez votre connexion puis réessayez.",
    retry: "Réessayer",
    capacity: "{capacity} places",
    duration: "{minutes} min",
    today: "Aujourd'hui",
    tomorrow: "Demain",
  },
} as const;
