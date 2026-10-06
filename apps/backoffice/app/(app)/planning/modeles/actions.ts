"use server";

import { templateChangesSchema, zonedDateKey } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { errorMessageKey } from "@/lib/flash";
import { type MessageKey, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { CellValue } from "@/components/inline/editable-cell";

const periodSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((period) => period.from <= period.to);

/** Génère les séances des cours actifs sur une période (bornes incluses), sans redirection. */
export async function generateSessions(input: { from: string; to: string }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const period = periodSchema.safeParse(input);
  if (!period.success) return fail("bookingErrors.invalid_period");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_sessions", {
    p_gym_id: context.gym.id,
    p_from: period.data.from,
    p_to: period.data.to,
  });
  revalidatePath("/planning");
  refresh();
  if (error) return fail(errorMessageKey(error));
  return ok("templates.generated", data ?? 0);
}

/**
 * Édition en place d'un cours récurrent : appliquée aux séances à venir non personnalisées
 * (jour ou heure changés : séances sans réservation régénérées au nouveau créneau).
 */
export async function updateTemplateField(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<{ error: MessageKey | null; message?: MessageKey; count?: number }> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  const changes = templateChangesSchema.safeParse({ [input.field]: input.value });
  if (!id.success || !changes.success || Object.keys(changes.data).length !== 1)
    return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_template", {
    p_template_id: id.data,
    p_changes: changes.data,
  });
  revalidatePath("/planning");
  refresh();
  if (error) return { error: errorMessageKey(error) };
  const result = z
    .object({ updated: z.number(), kept: z.number(), regenerated: z.number() })
    .catch({ updated: 0, kept: 0, regenerated: 0 })
    .parse(data);
  if (result.kept > 0)
    return { error: null, message: "templates.keptSessions", count: result.kept };
  return {
    error: null,
    message: "templates.updatedSessions",
    count: result.updated + result.regenerated,
  };
}

/** « + Nouveau cours » : lundi 18 h 30, première discipline active et ses valeurs par défaut. */
export async function createTemplateRow(): Promise<{ error: MessageKey | null; id?: string }> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data: discipline } = await supabase
    .from("disciplines")
    .select("id, default_duration_minutes, default_capacity")
    .eq("gym_id", context.gym.id)
    .eq("is_active", true)
    .order("position")
    .order("name")
    .limit(1)
    .maybeSingle();
  if (!discipline) return { error: "templates.errors.noDiscipline" };
  const { data, error } = await supabase
    .from("class_templates")
    .insert({
      gym_id: context.gym.id,
      discipline_id: discipline.id,
      weekday: 1,
      start_time: "18:30",
      duration_minutes: discipline.default_duration_minutes,
      capacity: discipline.default_capacity,
      starts_on: zonedDateKey(new Date(), context.gym.timezone),
      is_active: false,
    })
    .select("id")
    .single();
  refresh();
  return error || !data ? { error: "common.unexpectedError" } : { error: null, id: data.id };
}

/** « Dupliquer » : même cours, inactif (brouillon à ajuster avant de l'activer). */
export async function duplicateTemplate(input: {
  id: string;
}): Promise<{ error: MessageKey | null; id?: string }> {
  const context = await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("class_templates")
    .select(
      "discipline_id, weekday, start_time, duration_minutes, capacity, room_id, starts_on, ends_on, template_coaches(coach_id, position)",
    )
    .eq("id", id.data)
    .eq("gym_id", context.gym.id)
    .maybeSingle();
  if (!source) return { error: "common.unexpectedError" };
  const { template_coaches: coaches, ...row } = source;
  const { data, error } = await supabase
    .from("class_templates")
    .insert({ ...row, gym_id: context.gym.id, is_active: false })
    .select("id")
    .single();
  if (error || !data) return { error: "common.unexpectedError" };
  const coachIds = [...coaches].sort((a, b) => a.position - b.position).map((c) => c.coach_id);
  if (coachIds.length) {
    // Coachs d'un cours : uniquement par update_template.
    const { error: coachError } = await supabase.rpc("update_template", {
      p_template_id: data.id,
      p_changes: { coach_ids: coachIds },
    });
    if (coachError) return { error: errorMessageKey(coachError) };
  }
  refresh();
  return { error: null, id: data.id };
}

const SLOT_FIELDS = ["weekday", "start_time", "starts_on", "ends_on", "is_active"];

/**
 * Avant de changer le créneau d'un cours (jour, heure, période) ou de le désactiver : séances à
 * venir concernées, réservées gardées. Rien à confirmer s'il n'y en a aucune.
 */
export async function previewTemplateChange(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<{ title: string; description: string } | null> {
  await requireRole(isManagerRole);
  if (!SLOT_FIELDS.includes(input.field)) return null;
  if (input.field === "is_active" && input.value !== false) return null;
  const id = z.guid().safeParse(input.id);
  if (!id.success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("template_change_preview", { p_template_id: id.data })
    .single();
  if (!data || data.sessions === 0) return null;
  const deactivate = input.field === "is_active";
  const replaced = data.sessions - data.kept;
  return {
    title: t(deactivate ? "templates.impact.deactivateTitle" : "templates.impact.title"),
    description: [
      t(deactivate ? "templates.impact.removed" : "templates.impact.replaced", {
        count: replaced,
      }),
      data.kept ? t("templates.impact.kept", { count: data.kept, booked: data.booked }) : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
