/** Sections de la page Paramètres, dans l'ordre de la navigation (`?onglet=`). */
export const SETTINGS_SECTIONS = [
  "salle",
  "reservations",
  "strategies",
  "accueil",
  "suivi",
  "catalogue",
  "offres",
  "equipe",
  "integrations",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** Lien profond vers une section (« Salle » est la section par défaut). */
export function settingsHref(section: SettingsSection): string {
  return section === "salle" ? "/parametres" : `/parametres?onglet=${section}`;
}
