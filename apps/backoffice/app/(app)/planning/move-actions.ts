"use server";

import { zonedInstant } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const moveSchema = z.object({
  sessionId: z.guid(),
  dayKey: z.iso.date(),
  minutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
});
type MoveInput = z.input<typeof moveSchema>;

export type MovePreview =
  | { error: MessageKey }
  | {
      error: null;
      startsAt: string;
      booked: number;
      waitlisted: number;
      coachConflict: boolean;
    };

/** Aperçu avant confirmation : nouvel horaire, inscrits à prévenir, chevauchement du coach. */
export async function previewMove(input: MoveInput): Promise<MovePreview> {
  const context = await requireRole(isManagerRole);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const startsAt = zonedInstant(
    parsed.data.dayKey,
    parsed.data.minutes,
    context.gym.timezone,
  ).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("session_move_preview", { p_session_id: parsed.data.sessionId, p_starts_at: startsAt })
    .single();
  if (error || !data) return { error: errorMessageKey(error) };
  return {
    error: null,
    startsAt,
    booked: data.booked,
    waitlisted: data.waitlisted,
    coachConflict: data.coach_conflict,
  };
}

/** Déplacement confirmé (glisser-déposer) : renvoie l'erreur éventuelle au client. */
export async function moveSession(input: MoveInput): Promise<{ error: MessageKey | null }> {
  const context = await requireRole(isManagerRole);
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_session", {
    p_session_id: parsed.data.sessionId,
    p_starts_at: zonedInstant(
      parsed.data.dayKey,
      parsed.data.minutes,
      context.gym.timezone,
    ).toISOString(),
  });
  revalidatePath("/planning");
  revalidatePath(`/planning/${parsed.data.sessionId}`);
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}

/** « Déplacer… » au clavier, depuis la fiche séance : date et heure saisies. */
export async function moveSessionForm(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const sessionId = z.guid().parse(formData.get("sessionId"));
  const back = `/planning/${sessionId}`;
  const date = z.iso.date().safeParse(formData.get("date"));
  const time = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .safeParse(formData.get("time"));
  if (!date.success || !time.success) redirect(withFlash(back, { error: "session.moveInvalid" }));
  const [h, m] = time.data.split(":").map(Number);
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_session", {
    p_session_id: sessionId,
    p_starts_at: zonedInstant(
      date.data,
      (h ?? 0) * 60 + (m ?? 0),
      context.gym.timezone,
    ).toISOString(),
  });
  revalidatePath("/planning");
  revalidatePath(back);
  redirect(withFlash(back, error ? { error: errorMessageKey(error) } : { ok: "session.moved" }));
}

const createSchema = moveSchema.omit({ sessionId: true }).extend({
  disciplineId: z.guid(),
  coachIds: z.array(z.guid()).max(4).default([]),
  roomId: z.guid().nullable().default(null),
});

/** Séance ponctuelle créée depuis un créneau vide (ou « + Nouveau ») : discipline, coachs, salle. */
export async function createSessionAt(
  input: z.input<typeof createSchema>,
): Promise<{ error: MessageKey | null }> {
  const context = await requireRole(isManagerRole);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_session", {
    p_gym_id: context.gym.id,
    p_discipline_id: parsed.data.disciplineId,
    p_starts_at: zonedInstant(
      parsed.data.dayKey,
      parsed.data.minutes,
      context.gym.timezone,
    ).toISOString(),
    p_coach_ids: parsed.data.coachIds,
    ...(parsed.data.roomId ? { p_room_id: parsed.data.roomId } : {}),
  });
  revalidatePath("/planning");
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}
