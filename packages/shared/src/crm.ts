import { z } from "zod";

/**
 * Filtres d'un segment (segments.filters), combinés en ET. Miroir de la fonction SQL
 * public.filter_members : une clé absente n'applique aucun filtre.
 */
export const segmentFiltersSchema = z
  .object({
    statuses: z.array(z.enum(["prospect", "active", "suspended", "cancelled"])).max(4),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    inactive_days: z.number().int().min(1).max(365),
    discipline_id: z.guid(),
    max_credits: z.number().int().min(0).max(100),
    joined_since: z.iso.date(),
    birthday_month: z.literal(true),
    email_consent: z.literal(true),
  })
  .partial()
  .strict();

export type SegmentFilters = z.infer<typeof segmentFiltersSchema>;

/** Lit des filtres enregistrés : les clés invalides sont ignorées plutôt que de tout rejeter. */
export function parseSegmentFilters(raw: unknown): SegmentFilters {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const filters: SegmentFilters = {};
  for (const key of Object.keys(segmentFiltersSchema.shape) as (keyof SegmentFilters)[]) {
    const parsed = segmentFiltersSchema.shape[key].safeParse(source[key]);
    if (parsed.success && parsed.data !== undefined) Object.assign(filters, { [key]: parsed.data });
  }
  return filters;
}

/** Étapes du pipeline CRM (fonction SQL crm_pipeline), dans l'ordre d'affichage. */
export const PIPELINE_STAGES = ["lead", "trial", "active", "suspended", "cancelled"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Tag qui fait passer un prospect à l'étape « Essai » du pipeline. */
export const TRIAL_TAG = "essai";

/** Tags normalisés : minuscules, espaces réduits, sans doublon. */
export function normalizeTags(tags: readonly string[]): string[] {
  return [
    ...new Set(
      tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " ")).filter((tag) => tag !== ""),
    ),
  ];
}

/** Ce qu'implique le passage d'une carte du pipeline d'une étape à une autre. */
export type PipelineMove =
  | { kind: "add_trial_tag" }
  | { kind: "remove_trial_tag" }
  | { kind: "status"; status: "active" | "suspended" | "cancelled"; confirm: boolean };

/**
 * Transitions autorisées par glisser-déposer (règles de set_member_status et tag « essai ») :
 * Prospect ⇄ Essai, Prospect/Essai → Actif, Actif ⇄ Suspendu, toute étape → Résilié (avec
 * confirmation : adhésion arrêtée ou prospect perdu), Résilié → Actif. Le reste est refusé.
 */
export function pipelineMove(from: PipelineStage, to: PipelineStage): PipelineMove | null {
  if (from === to) return null;
  if (from === "lead" && to === "trial") return { kind: "add_trial_tag" };
  if (from === "trial" && to === "lead") return { kind: "remove_trial_tag" };
  if (to === "active" && from !== "active")
    return { kind: "status", status: "active", confirm: false };
  if (from === "active" && to === "suspended")
    return { kind: "status", status: "suspended", confirm: false };
  // Résilié : adhésion arrêtée, ou prospect perdu.
  if (to === "cancelled") return { kind: "status", status: "cancelled", confirm: true };
  return null;
}
