"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { type BillingRequest, callBilling } from "@/lib/billing";
import { stripeErrorKey } from "@/lib/stripe-errors";

async function run(body: BillingRequest, success: "offers.syncDone" | "payments.refundRequested") {
  await requireRole(isManagerRole);
  const result = await callBilling(body);
  if (!result.ok) return fail(stripeErrorKey(result.error));
  refresh();
  return ok(success);
}

/** Offre poussée vers Stripe (produit et prix ; nouveau prix si le montant a changé). */
export async function syncPlanWithStripe(input: { id: string }): Promise<ActionResult> {
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("stripeErrors.unexpected");
  return run({ action: "sync_plan", planId: id.data }, "offers.syncDone");
}

/** Code promo poussé vers Stripe (coupon appliqué à la première échéance). */
export async function syncPromoWithStripe(input: { id: string }): Promise<ActionResult> {
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("stripeErrors.unexpected");
  return run({ action: "sync_promo", promoId: id.data }, "offers.syncDone");
}

/** Remboursement d'un paiement en ligne : le webhook le marque remboursé et retire les crédits. */
export async function refundPayment(input: { id: string }): Promise<ActionResult> {
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("stripeErrors.unexpected");
  return run({ action: "refund", paymentId: id.data }, "payments.refundRequested");
}
