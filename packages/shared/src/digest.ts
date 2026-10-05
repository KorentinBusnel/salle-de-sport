import { z } from "zod";

/** Catégories du digest quotidien de l'assistant (Hub 360° et accueil). */
export const DIGEST_CATEGORIES = ["operations", "clients", "finance"] as const;
export type DigestCategory = (typeof DIGEST_CATEGORIES)[number];

/**
 * Sources que l'assistant lit. Les quatre dernières attendent leurs connecteurs (BRIEF §12) :
 * elles s'affichent « à connecter » tant qu'elles ne sont pas branchées.
 */
export const DIGEST_SOURCES = [
  "bookings",
  "payments",
  "crm",
  "messages",
  "gmail",
  "whatsapp",
  "qonto",
  "pennylane",
] as const;
export type DigestSource = (typeof DIGEST_SOURCES)[number];
export const CONNECTED_DIGEST_SOURCES = [
  "bookings",
  "payments",
  "crm",
  "messages",
] as const satisfies readonly DigestSource[];

const text = (max: number) => z.string().trim().min(1).max(max);

/** Bouton d'action : libellé court et demande préparée pour l'assistant. */
export const digestActionSchema = z.object({
  label: text(40),
  prompt: text(500),
});

export const digestItemSchema = z.object({
  id: text(40),
  source: z.enum(DIGEST_SOURCES),
  from: text(80),
  /** Extrait lu (ce qui a déclenché la proposition). */
  read: text(280),
  /** Action proposée, à l'impératif. */
  action: text(160),
  cta: text(40),
  prompt: text(500),
  memberId: z.guid().optional(),
});
export type DigestItem = z.infer<typeof digestItemSchema>;

/** Brief du jour : une ou deux phrases à l'impératif, au plus deux boutons. */
export const digestBriefSchema = z.object({
  text: text(320),
  actions: z.array(digestActionSchema).max(2),
});

export const digestCategorySchema = z.object({
  key: z.enum(DIGEST_CATEGORIES),
  /** Synthèse en une phrase, tournée vers l'action. */
  summary: text(240),
  items: z.array(digestItemSchema).max(6),
});

/** Ce que l'assistant rend (outil `submit_digest`). */
export const digestInputSchema = z.object({
  brief: digestBriefSchema,
  categories: z
    .array(digestCategorySchema)
    .length(DIGEST_CATEGORIES.length)
    .refine(
      (categories) => DIGEST_CATEGORIES.every((key) => categories.some((c) => c.key === key)),
      "Une entrée par catégorie (operations, clients, finance).",
    ),
});

/** Contenu de `daily_digests.content` : le digest et les actions écartées par le gérant. */
export const dailyDigestSchema = digestInputSchema.extend({
  dismissed: z.array(z.string()).default([]),
});
export type DailyDigest = z.infer<typeof dailyDigestSchema>;

/** Actions encore ouvertes (non écartées), toutes catégories confondues. */
export function openDigestItems(digest: DailyDigest): DigestItem[] {
  const dismissed = new Set(digest.dismissed);
  return digest.categories.flatMap((c) => c.items.filter((item) => !dismissed.has(item.id)));
}
