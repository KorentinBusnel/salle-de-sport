"use server";

import { revalidatePath } from "next/cache";
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
  await finish(
    sessionId,
    () => supabase.rpc("book_session", { p_session_id: sessionId, p_member_id: memberId }),
    "session.booked",
  );
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
