"use server";

import {
  clockToMinutes,
  type DeskShiftInput,
  deskShiftInputSchema,
  zonedInstant,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Result = { error: MessageKey | null };

function done(error: { message?: string } | null): Result {
  revalidatePath("/");
  revalidatePath("/planning");
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}

/** Crée ou modifie une permanence à l'accueil (gérant). */
export async function saveDeskShift(input: DeskShiftInput): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const parsed = deskShiftInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.some((i) => i.message === "end_before_start")
        ? "desk.errors.endBeforeStart"
        : "common.unexpectedError",
    };
  }
  const { id, profileId, date, start, end, note } = parsed.data;
  const tz = context.gym.timezone;
  const row = {
    gym_id: context.gym.id,
    profile_id: profileId,
    starts_at: zonedInstant(date, clockToMinutes(start), tz).toISOString(),
    ends_at: zonedInstant(date, clockToMinutes(end), tz).toISOString(),
    note: note || null,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("desk_shifts").update(row).eq("id", id).eq("gym_id", context.gym.id)
    : await supabase.from("desk_shifts").insert(row);
  return done(error);
}

/** Supprime une permanence (gérant). */
export async function deleteDeskShift(id: string): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("desk_shifts")
    .delete()
    .eq("id", parsed.data)
    .eq("gym_id", context.gym.id);
  return done(error);
}
