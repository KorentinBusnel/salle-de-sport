/**
 * Phrases du catalogue avec mots clés en pastille : `[mot](icône)` devient une pastille avec
 * icône, `**texte**` un passage en gras. La ponctuation collée à une pastille (« , », « . »)
 * reste sur la même ligne qu'elle. Aucune dépendance React : testé dans rich-text.test.ts.
 */

/** Icônes des pastilles, dans l'ordre de components/rich-text.tsx (KEYWORD_ICONS). */
export const KEYWORD_ICON_NAMES = [
  "calendar",
  "coins",
  "chart",
  "users",
  "mail",
  "slots",
  "waitlist",
  "target",
  "injury",
  "presence",
  "card",
  "debit",
  "accounting",
  "rules",
  "pay",
] as const;
export type KeywordIconName = (typeof KEYWORD_ICON_NAMES)[number];

export type RichSegment =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "keyword"; text: string; icon: KeywordIconName; after: string };

const TOKEN = /\[([^\]]+)\]\(([a-z]+)\)([^\s[*]*)|\*\*([^*]+)\*\*/g;

function isIconName(name: string): name is KeywordIconName {
  return (KEYWORD_ICON_NAMES as readonly string[]).includes(name);
}

export function parseRichText(source: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    const [whole, keyword, icon, after, strong] = match;
    if (match.index > last) segments.push({ kind: "text", text: source.slice(last, match.index) });
    if (strong !== undefined) {
      segments.push({ kind: "strong", text: strong });
    } else if (keyword !== undefined && icon !== undefined && isIconName(icon)) {
      segments.push({ kind: "keyword", text: keyword, icon, after: after ?? "" });
    } else {
      // Icône inconnue : le mot reste du texte simple (un test du catalogue l'interdit).
      segments.push({ kind: "text", text: `${keyword ?? ""}${after ?? ""}` });
    }
    last = match.index + whole.length;
  }
  if (last < source.length) segments.push({ kind: "text", text: source.slice(last) });
  return segments;
}

/** Texte brut d'une phrase enrichie (métadonnées, lecteurs sans mise en forme). */
export function plainText(source: string): string {
  return parseRichText(source)
    .map((segment) =>
      segment.kind === "keyword" ? `${segment.text}${segment.after}` : segment.text,
    )
    .join("");
}
