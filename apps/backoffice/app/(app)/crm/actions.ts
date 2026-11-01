"use server";

import {
  FIELD_KEY_PATTERN,
  normalizeTags,
  PIPELINE_STAGES,
  pipelineMove,
  TRIAL_TAG,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const moveSchema = z.object({
  memberId: z.guid(),
  from: z.enum(PIPELINE_STAGES),
  to: z.enum(PIPELINE_STAGES),
});

/**
 * Déplacement d'une carte du pipeline : tag « essai » ou set_member_status selon la
 * transition (pipelineMove). La base reste juge ; la carte revient en cas de refus.
 */
export async function moveMemberStage(
  input: z.input<typeof moveSchema>,
): Promise<{ error: MessageKey | null }> {
  const context = await requireRole(isManagerRole);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const move = pipelineMove(parsed.data.from, parsed.data.to);
  if (!move) return { error: "crm.errors.notAllowed" };

  const supabase = await createClient();
  let error: { message?: string } | null = null;
  if (move.kind === "status") {
    ({ error } = await supabase.rpc("set_member_status", {
      p_member_id: parsed.data.memberId,
      p_status: move.status,
    }));
  } else {
    const { data: member } = await supabase
      .from("members")
      .select("tags")
      .eq("id", parsed.data.memberId)
      .eq("gym_id", context.gym.id)
      .single();
    if (!member) return { error: "common.unexpectedError" };
    if (move.kind === "remove_trial_tag") {
      // Un prospect qui a déjà réservé reste « Essai » : le tag n'y change rien.
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("member_id", parsed.data.memberId)
        .neq("status", "cancelled");
      if (count) return { error: "crm.errors.alreadyBooked" };
    }
    const tags =
      move.kind === "add_trial_tag"
        ? [...member.tags, TRIAL_TAG]
        : member.tags.filter((tag) => tag !== TRIAL_TAG);
    ({ error } = await supabase
      .from("members")
      .update({ tags: normalizeTags(tags) })
      .eq("id", parsed.data.memberId)
      .eq("gym_id", context.gym.id));
  }
  revalidatePath("/crm");
  revalidatePath("/adherents", "layout");
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}

const fieldMoveSchema = z.object({
  memberId: z.guid(),
  key: z.string().regex(FIELD_KEY_PATTERN),
  // Valeur d'option, ou null pour la colonne « Sans valeur ».
  to: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_]{0,39}$/)
    .nullable(),
});

/**
 * Déplacement d'une carte d'un kanban groupé par un champ liste : la valeur du champ devient
 * l'option de la colonne d'arrivée (set_member_field valide l'option ; null l'efface).
 */
export async function moveMemberToOption(
  input: z.input<typeof fieldMoveSchema>,
): Promise<{ error: MessageKey | null }> {
  await requireRole(isManagerRole);
  const parsed = fieldMoveSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_field", {
    p_member_id: parsed.data.memberId,
    p_key: parsed.data.key,
    p_value: parsed.data.to,
  });
  revalidatePath("/crm");
  revalidatePath("/adherents", "layout");
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}
