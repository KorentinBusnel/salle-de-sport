"use server";

import { MANUAL_PAYMENT_METHODS } from "@salle/shared";
import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireTeamContext } from "@/lib/auth";
import { errorMessageKey } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const saleSchema = z.object({
  memberId: z.guid(),
  planId: z.guid(),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  promoCode: z.string().trim().max(30).optional(),
});

/** Vente sur place (record_manual_sale : droits, prix et code vérifiés en SQL). */
export async function recordSale(input: z.input<typeof saleSchema>): Promise<ActionResult> {
  await requireTeamContext();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_sale", {
    p_member_id: parsed.data.memberId,
    p_plan_id: parsed.data.planId,
    p_method: parsed.data.method,
    ...(parsed.data.promoCode ? { p_promo_code: parsed.data.promoCode } : {}),
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("billing.saleRecorded");
}

/** Une période de plus pour un abonnement suivi à la main, payée sur place. */
export async function renewSubscription(input: {
  subscriptionId: string;
  method: string;
}): Promise<ActionResult> {
  await requireTeamContext();
  const id = z.guid().safeParse(input.subscriptionId);
  const method = z.enum(MANUAL_PAYMENT_METHODS).safeParse(input.method);
  if (!id.success || !method.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("renew_manual_subscription", {
    p_subscription_id: id.data,
    p_method: method.data,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("billing.renewed");
}

/** Fin d'un abonnement suivi à la main, au terme de la période payée (gérant). */
export async function cancelSubscription(input: { subscriptionId: string }): Promise<ActionResult> {
  await requireTeamContext();
  const id = z.guid().safeParse(input.subscriptionId);
  if (!id.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_manual_subscription", {
    p_subscription_id: id.data,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("billing.cancelled");
}
