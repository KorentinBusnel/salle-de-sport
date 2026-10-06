"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { classChangesSchema } from "@salle/shared";
import type { CellValue } from "@/components/inline/editable-cell";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const uuid = z.guid();

/** Exécute un appel puis revient sur la séance avec un message de succès ou d'erreur. */
async function finish(
  sessionId: string,
  run: () => PromiseLike<{ error: { message?: string } | null }>,
  ok: MessageKey,
) {
  const { error } = await run();
  revalidatePath(`/planning/${sessionId}`);
  revalidatePath("/planning");
  redirect(withFlash(`/planning/${sessionId}`, error ? { error: errorMessageKey(error) } : { ok }));
}

export async function cancelBooking(formData: FormData) {
  const sessionId = uuid.parse(formData.get("sessionId"));
  const bookingId = uuid.parse(formData.get("bookingId"));
  const supabase = await createClient();
  await finish(
    sessionId,
    () => supabase.rpc("cancel_booking", { p_booking_id: bookingId }),
    "session.bookingCancelled",
  );
}

export async function setAttendance(formData: FormData) {
  const sessionId = uuid.parse(formData.get("sessionId"));
  const bookingId = uuid.parse(formData.get("bookingId"));
  const status = z.enum(["attended", "no_show"]).parse(formData.get("status"));
  const supabase = await createClient();
  await finish(
    sessionId,
    () => supabase.rpc("set_attendance", { p_booking_id: bookingId, p_status: status }),
    "session.attendanceSaved",
  );
}

export async function cancelSession(formData: FormData) {
  const sessionId = uuid.parse(formData.get("sessionId"));
  const reason = z
    .string()
    .trim()
    .max(200)
    .parse(formData.get("reason") ?? "");
  const supabase = await createClient();
  await finish(
    sessionId,
    () =>
      supabase.rpc(
        "cancel_session",
        reason ? { p_session_id: sessionId, p_reason: reason } : { p_session_id: sessionId },
      ),
    "session.sessionCancelled",
  );
}

const attendanceSchema = z.object({
  bookingId: uuid,
  sessionId: uuid,
  status: z.enum(["attended", "no_show"]),
});

/** Pointage depuis le contrôle segmenté : renvoie l'erreur au lieu de rediriger. */
export async function markAttendance(
  input: z.input<typeof attendanceSchema>,
): Promise<{ error: MessageKey | null }> {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_attendance", {
    p_booking_id: parsed.data.bookingId,
    p_status: parsed.data.status,
  });
  revalidatePath(`/planning/${parsed.data.sessionId}`);
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}

const resetSchema = attendanceSchema.pick({ bookingId: true, sessionId: true });

/** Remise à « confirmé » d'un pointage (stratégie allow_attendance_reset). */
export async function resetAttendance(
  input: z.input<typeof resetSchema>,
): Promise<{ error: MessageKey | null }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_attendance", {
    p_booking_id: parsed.data.bookingId,
  });
  revalidatePath(`/planning/${parsed.data.sessionId}`);
  refresh();
  return { error: error ? errorMessageKey(error) : null };
}

/**
 * Édition en place d'une séance (gérant) : un champ à la fois, pour cette séance ou, si elle
 * vient d'un cours récurrent, pour elle et les suivantes. update_session tranche.
 */
export async function updateSessionField(input: {
  id: string;
  field: string;
  value: CellValue;
  scope?: "one" | "following" | undefined;
}): Promise<{ error: MessageKey | null; message?: MessageKey; count?: number }> {
  await requireRole(isManagerRole);
  const id = uuid.safeParse(input.id);
  const changes = classChangesSchema.safeParse({ [input.field]: input.value });
  if (!id.success || !changes.success || Object.keys(changes.data).length !== 1)
    return { error: "common.unexpectedError" };
  const scope = input.scope === "following" ? "following" : "one";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_session", {
    p_session_id: id.data,
    p_changes: changes.data,
    p_scope: scope,
  });
  revalidatePath(`/planning/${id.data}`);
  revalidatePath("/planning");
  refresh();
  if (error) return { error: errorMessageKey(error) };
  return scope === "following"
    ? { error: null, message: "session.updatedFollowing", count: data }
    : { error: null, message: "session.updated" };
}

const bookSchema = z.object({ sessionId: uuid, memberId: uuid });

/** Inscription depuis la fiche (accueil) : la ligne apparaît tout de suite, pas de redirection. */
export async function bookMemberQuick(input: z.input<typeof bookSchema>): Promise<ActionResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_session", {
    p_session_id: parsed.data.sessionId,
    p_member_id: parsed.data.memberId,
  });
  revalidatePath("/planning");
  refresh();
  if (error) return fail(errorMessageKey(error));
  // Séance complète : book_session place l'adhérent en liste d'attente.
  return ok(data?.status === "waitlisted" ? "session.addedToWaitlist" : "session.booked");
}

/** « Tous présents » en un appel (set_attendance_many) : renvoie les réservations pointées. */
export async function markAllAttendedQuick(input: {
  sessionId: string;
}): Promise<ActionResult<string[]>> {
  const sessionId = uuid.safeParse(input.sessionId);
  if (!sessionId.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_attendance_many", {
    p_session_id: sessionId.data,
  });
  refresh();
  if (error) return fail(errorMessageKey(error));
  return { ok: true, data: data ?? [], count: data?.length ?? 0 };
}

const resetManySchema = z.object({ sessionId: uuid, bookingIds: z.array(uuid).max(200) });

/** « Annuler » après « Tous présents » : chaque pointage revient à « confirmé » (stratégie). */
export async function resetAttendanceMany(
  input: z.input<typeof resetManySchema>,
): Promise<ActionResult> {
  const parsed = resetManySchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  let failed: { message?: string } | null = null;
  for (const bookingId of parsed.data.bookingIds) {
    const { error } = await supabase.rpc("reset_attendance", { p_booking_id: bookingId });
    if (error) failed = error;
  }
  refresh();
  return failed ? fail(errorMessageKey(failed)) : ok();
}
