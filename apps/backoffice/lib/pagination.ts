export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Taille de page lue dans l'URL (`?taille=`), 25 par défaut. */
export function pageSizeOf(value: string | undefined): PageSize {
  return PAGE_SIZES.find((size) => String(size) === value) ?? 25;
}

/**
 * Pages à afficher (Watermelon pagination-12) : la première, la dernière, la page courante et
 * ses voisines ; « gap » pour une coupure. Une coupure d'une seule page affiche la page.
 */
export function pageWindow(page: number, pages: number, span = 1): (number | "gap")[] {
  const keep = new Set<number>([1, pages]);
  for (let p = page - span; p <= page + span; p += 1) if (p >= 1 && p <= pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (const [index, p] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous === 2) result.push(previous + 1);
    else if (previous !== undefined && p - previous > 2) result.push("gap");
    result.push(p);
  }
  return result;
}
