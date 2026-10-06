/**
 * Palette ⌘K : entrées statiques (pages, réglages, actions) construites côté serveur selon le
 * rôle, filtrées côté client sans accents ni casse, et « Récents » mémorisés dans le navigateur.
 */

export type PaletteGroup = "goto" | "settings" | "actions";
export type PaletteIcon =
  | "today"
  | "planning"
  | "templates"
  | "members"
  | "messages"
  | "coaches"
  | "hours"
  | "crm"
  | "segments"
  | "emailing"
  | "kpis"
  | "hub"
  | "settings"
  | "payments"
  | "marketplace"
  | "platform"
  | "member"
  | "session"
  | "campaign";

export type PaletteEntry = {
  group: PaletteGroup;
  href: string;
  label: string;
  /** Phrase d'aide affichée à droite et cherchée avec le libellé. */
  hint?: string | undefined;
  icon: PaletteIcon;
};

export type RecentEntry = { href: string; label: string; kind: "member" | "page" };

/** Clé de stockage propre à chaque compte (poste d'accueil partagé : pas de fiche d'un autre). */
export function recentsKey(userId: string): string {
  return `palette:recents:${userId}`;
}
export const RECENTS_MAX = 5;

/** Recherche sans accents ni casse (« reglages » trouve « Réglages »). */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Entrées dont chaque mot de la frappe figure dans le libellé ou l'aide ; celles dont le libellé
 * commence par la frappe passent devant. Sans frappe, tout est rendu dans l'ordre d'origine.
 */
export function filterEntries<T extends { label: string; hint?: string | undefined }>(
  entries: readonly T[],
  query: string,
): T[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  const needle = words.join(" ");
  return entries
    .map((entry, index) => {
      const label = foldText(entry.label);
      const haystack = `${label} ${foldText(entry.hint ?? "")}`;
      if (!words.every((word) => haystack.includes(word))) return null;
      return { entry, index, rank: label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : 2 };
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.entry);
}

/** Ajoute une entrée en tête des récents, sans doublon, au plus RECENTS_MAX. */
export function pushRecent(recents: readonly RecentEntry[], entry: RecentEntry): RecentEntry[] {
  return [entry, ...recents.filter((item) => item.href !== entry.href)].slice(0, RECENTS_MAX);
}

/** Lecture tolérante du stockage : une valeur abîmée ou étrangère donne une liste vide. */
export function parseRecents(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RecentEntry =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as RecentEntry).href === "string" &&
          (item as RecentEntry).href.startsWith("/") &&
          !(item as RecentEntry).href.startsWith("//") &&
          typeof (item as RecentEntry).label === "string" &&
          ((item as RecentEntry).kind === "member" || (item as RecentEntry).kind === "page"),
      )
      .slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}
