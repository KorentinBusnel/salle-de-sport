"use server";

import { templateChangesSchema, zonedDateKey } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { CellValue } from "@/components/inline/editable-cell";

const PATH = "/planning/modeles";
export async function generateSessions(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const period = z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .safeParse({ from: formData.get("from"), to: formData.get("to") });
  if (!period.success) redirect(withFlash(PATH, { error: "bookingErrors.invalid_period" }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_sessions", {
    p_gym_id: context.gym.id,
    p_from: period.data.from,
    p_to: period.data.to,
  });
  revalidatePath(PATH);
  revalidatePath("/planning");
  if (error) redirect(withFlash(PATH, { error: errorMessageKey(error) }));
  redirect(withFlash(PATH, { ok: "templates.generated", count: data ?? 0 }));
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
  revalidatePath(PATH);
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
export async function createTemplateRow(): Promise<{ error: MessageKey | null }> {
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
  const { error } = await supabase.from("class_templates").insert({
    gym_id: context.gym.id,
    discipline_id: discipline.id,
    weekday: 1,
    start_time: "18:30",
    duration_minutes: discipline.default_duration_minutes,
    capacity: discipline.default_capacity,
    starts_on: zonedDateKey(new Date(), context.gym.timezone),
    is_active: false,
  });
  revalidatePath(PATH);
  refresh();
  return { error: error ? "common.unexpectedError" : null };
}
