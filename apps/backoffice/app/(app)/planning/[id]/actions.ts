"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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

export async function bookMember(formData: FormData) {
  const sessionId = uuid.parse(formData.get("sessionId"));
  const memberId = uuid.parse(formData.get("memberId"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_session", {
    p_session_id: sessionId,
    p_member_id: memberId,
  });
  revalidatePath(`/planning/${sessionId}`);
  revalidatePath("/planning");
  // Séance complète : book_session place l'adhérent en liste d'attente.
  const ok: MessageKey =
    data?.status === "waitlisted" ? "session.addedToWaitlist" : "session.booked";
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

/** « Tous présents » : pointe présents les inscrits encore confirmés (même fonction SQL). */
export async function markAllAttended(formData: FormData) {
  const sessionId = uuid.parse(formData.get("sessionId"));
  const supabase = await createClient();
  const { data: bookings, error: loadError } = await supabase
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("status", "confirmed");
  if (loadError) {
    redirect(withFlash(`/planning/${sessionId}`, { error: "common.unexpectedError" }));
  }
  let failed: { message?: string } | null = null;
  for (const booking of bookings ?? []) {
    const { error } = await supabase.rpc("set_attendance", {
      p_booking_id: booking.id,
      p_status: "attended",
    });
    if (error) failed = error;
  }
  revalidatePath(`/planning/${sessionId}`);
  redirect(
    withFlash(
      `/planning/${sessionId}`,
      failed ? { error: errorMessageKey(failed) } : { ok: "session.allAttendedSaved" },
    ),
  );
}
