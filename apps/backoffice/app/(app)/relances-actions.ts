"use server";

import { MANUAL_PAYMENT_METHODS } from "@salle/shared";
import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isFrontDeskRole, requireRole } from "@/lib/auth";
import { errorMessageKey } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

/** Message proposé pour relancer un impayé (texte rendu en SQL, modifiable avant envoi). */
export async function loadReminder(input: {
  memberId: string;
}): Promise<ActionResult<{ subject: string; body: string }>> {
  await requireRole(isFrontDeskRole);
  const id = z.guid().safeParse(input.memberId);
  if (!id.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payment_reminder_preview", { p_member_id: id.data });
  if (error) return fail(errorMessageKey(error));
  const text = z.object({ subject: z.string(), body: z.string() }).safeParse(data);
  if (!text.success) return fail("common.unexpectedError");
  return { ok: true, data: text.data };
}

const reminderSchema = z.object({
  memberId: z.guid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

/** Relance d'un impayé (une par jour au plus, inscrite au journal). */
export async function sendReminder(input: z.input<typeof reminderSchema>): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return fail("unpaid.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_payment_reminder", {
    p_member_id: parsed.data.memberId,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("unpaid.reminded");
}

/** Règlement sur place d'un abonnement suivi à la main en impayé (accueil ou gérant). */
export async function settleUnpaid(input: {
  subscriptionId: string;
  method: string;
}): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const id = z.guid().safeParse(input.subscriptionId);
  const method = z.enum(MANUAL_PAYMENT_METHODS).safeParse(input.method);
  if (!id.success || !method.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_unpaid", {
    p_subscription_id: id.data,
    p_method: method.data,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("unpaid.settled");
}
