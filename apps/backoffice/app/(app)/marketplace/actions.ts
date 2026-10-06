"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { callBilling } from "@/lib/billing";
import { errorMessageKey } from "@/lib/flash";
import { appOrigin } from "@/lib/origin";
import { stripeErrorKey } from "@/lib/stripe-errors";
import { createClient } from "@/lib/supabase/server";

/** Quantité d'un produit dans le panier de la salle (0 : retiré). */
export async function setCartItem(input: {
  productId: string;
  quantity: number;
}): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.productId);
  const quantity = z.number().int().min(0).max(10000).safeParse(input.quantity);
  if (!id.success || !quantity.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_set_cart_item", {
    p_gym_id: context.gym.id,
    p_product_id: id.data,
    p_quantity: quantity.data,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok();
}

/** Le panier devient une commande à payer (prix figés au palier atteint). */
export async function checkoutCart(): Promise<ActionResult<{ id: string }>> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mp_checkout_cart", { p_gym_id: context.gym.id });
  if (error || !data) return fail(errorMessageKey(error));
  refresh();
  return { ok: true, message: "marketplace.ordered", data: { id: data.id } };
}

const quoteSchema = z.object({
  productId: z.guid().nullable(),
  title: z.string().trim().max(160),
  quantity: z.number().int().min(1).max(100000),
  message: z.string().trim().max(2000),
});

/** Demande de devis : un produit ou un service du catalogue, ou un besoin libre. */
export async function requestQuote(input: z.input<typeof quoteSchema>): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.productId && !parsed.data.title))
    return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_request_quote", {
    p_gym_id: context.gym.id,
    p_product_id: parsed.data.productId as string,
    p_title: parsed.data.title,
    p_quantity: parsed.data.quantity,
    p_message: parsed.data.message,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("marketplace.quote.sent");
}

async function byId(
  fn: "mp_accept_quote" | "mp_decline_quote",
  id: string,
  message: "marketplace.quotes.accepted" | "marketplace.quotes.declined",
): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_quote_id: parsed.data });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok(message);
}

export async function acceptQuote(input: { id: string }): Promise<ActionResult> {
  return byId("mp_accept_quote", input.id, "marketplace.quotes.accepted");
}

export async function declineQuote(input: { id: string }): Promise<ActionResult> {
  return byId("mp_decline_quote", input.id, "marketplace.quotes.declined");
}

/** Annulation d'une commande pas encore payée, ou réception d'une commande livrée. */
export async function updateOrder(input: {
  id: string;
  action: "cancel" | "receive";
}): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } =
    input.action === "cancel"
      ? await supabase.rpc("mp_cancel_order", { p_order_id: id.data })
      : await supabase.rpc("mp_receive_order", { p_order_id: id.data });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok(
    input.action === "cancel" ? "marketplace.orders.cancelled" : "marketplace.orders.received",
  );
}

/** Paiement d'une commande « à payer » : adresse de Stripe Checkout, retour sur les commandes. */
export async function payOrder(input: { id: string }): Promise<ActionResult<{ url: string }>> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("common.unexpectedError");
  const result = await callBilling({
    action: "mp_checkout",
    orderId: id.data,
    returnUrl: `${await appOrigin()}/marketplace/commandes`,
  });
  if (!result.ok) return fail(stripeErrorKey(result.error));
  const url = (result.data as { url?: unknown } | null)?.url;
  if (typeof url !== "string") return fail("stripeErrors.unexpected");
  return { ok: true, data: { url } };
}

/**
 * Engagement dans un achat groupé (ou nouvelle quantité). Sans carte enregistrée : adresse de
 * Stripe Checkout pour l'enregistrer, sans débit.
 */
export async function commitCampaign(input: {
  campaignId: string;
  quantity: number;
}): Promise<ActionResult<{ url: string | null }>> {
  const context = await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.campaignId);
  const quantity = z.number().int().min(1).max(10000).safeParse(input.quantity);
  if (!id.success) return fail("common.unexpectedError");
  if (!quantity.success) return fail("bookingErrors.mp_invalid_quantity");
  const result = await callBilling({
    action: "mp_commit",
    campaignId: id.data,
    gymId: context.gym.id,
    quantity: quantity.data,
    returnUrl: `${await appOrigin()}/marketplace`,
  });
  if (!result.ok) return fail(stripeErrorKey(result.error));
  const url = (result.data as { url?: unknown } | null)?.url;
  if (typeof url !== "string") {
    refresh();
    return { ok: true, message: "marketplace.groupBuy.updated", data: { url: null } };
  }
  return { ok: true, data: { url } };
}

/** Retrait d'un engagement tant que l'achat groupé est ouvert. */
export async function withdrawCommitment(input: { id: string }): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_withdraw", { p_commitment_id: id.data });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("marketplace.groupBuy.withdrawn");
}
