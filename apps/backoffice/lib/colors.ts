import { categoryPalette } from "@salle/ui";

/**
 * Couleur de chaque coach dans le planning (« Couleurs : par coach ») : la palette de catégorie
 * dans l'ordre de la liste des coachs de la salle (triée par nom), stable d'une semaine à
 * l'autre. Au-delà de la palette, les couleurs reviennent.
 */
export function coachColors(coachIds: readonly string[]): Map<string, string> {
  return new Map(
    coachIds.map((id, index) => [id, categoryPalette[index % categoryPalette.length] ?? "#475569"]),
  );
}
