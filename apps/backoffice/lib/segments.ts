import {
  filtersFromSearch as sharedFiltersFromSearch,
  filtersToPairs,
  hasFilters,
  type SearchParams,
  type SegmentFilters,
} from "@salle/shared";

/**
 * Filtres de segment ⇄ paramètres d'URL. La règle (clés, alias, format) vit dans
 * `packages/shared/src/views.ts` ; ici seulement l'assemblage en `URLSearchParams` (Next).
 */

/** Filtres lus dans l'URL, ou `null` si l'URL n'en dit rien. */
export function filtersFromSearch(params: SearchParams): SegmentFilters | null {
  return sharedFiltersFromSearch(params);
}

/** Requête d'URL d'un jeu de filtres (sans `?`). */
export function filtersToSearch(filters: SegmentFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of filtersToPairs(filters)) query.set(key, value);
  return query.toString();
}

export { hasFilters };
