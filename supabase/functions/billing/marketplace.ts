import { fail, json } from "../_shared/http.ts";
import type { Stripe } from "../_shared/stripe.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

/**
 * Marketplace : la salle paie la plateforme (cliente Stripe `gym_billing`). Commande réglée par
 * Stripe Checkout ; achat groupé : carte enregistrée sans débit (Checkout « setup »), débitée à
 * la clôture au prix du palier atteint. Le webhook tient la base à jour (metadata.kind).
 */

type Gym = { id: string; name: string };

type PaymentContext = {
  order: { id: string; gym_id: string; reference: string; total_cents: number; currency: string };
  items: { name: string; unit: string | null; quantity: number; unit_price_cents: number }[];
  gym: Gym;
  customer_id: string | null;
};

type CommitResult = {
  commitment: { id: string; gym_id: string; quantity: number; status: string };
  campaign: { id: string; title: string };
  gym: Gym;
  customer_id: string | null;
};

type CloseResult = {
  status: "closed" | "cancelled";
  total_qty: number;
  charges: {
    order_id: string;
    commitment_id: string;
    gym_id: string;
    amount_cents: number;
    currency: string;
    customer_id: string | null;
    payment_method_id: string | null;
  }[];
};

/** Code d'erreur SQL (raise exception '<code>') ou générique. */
function sqlError(error: { message?: string } | null): string {
  const code = error?.message?.trim() ?? "";
  return /^[a-z_]+$/.test(code) ? code : "unexpected";
}

/** Adresse de retour avec un paramètre (`?paiement=ok`). */
function withParam(url: string, key: string, value: string): string {
  const next = new URL(url);
  next.searchParams.set(key, value);
  return next.toString();
}

/** Client Stripe de la salle, créé au premier achat et gardé dans gym_billing. */
async function ensureGymCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  gym: Gym,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  const customer = await stripe.customers.create({
    name: gym.name,
    metadata: { gym_id: gym.id },
  });
  const { error } = await admin
    .from("gym_billing")
    .upsert({ gym_id: gym.id, stripe_customer_id: customer.id });
  if (error) throw new Error(error.message ?? "database_error");
  return customer.id;
}

/** Paiement d'une commande « à payer » (gérant) : URL de Stripe Checkout. */
export async function marketplaceCheckout(
  stripe: Stripe,
  admin: SupabaseClient,
  user: SupabaseClient,
  input: { orderId: string; returnUrl: string },
): Promise<Response> {
  const { data, error } = await user.rpc("mp_payment_context", { p_order_id: input.orderId });
  if (error) return fail(sqlError(error));
  const ctx = data as PaymentContext;
  const customer = await ensureGymCustomer(stripe, admin, ctx.gym, ctx.customer_id);
  const metadata = { kind: "marketplace", order_id: ctx.order.id, gym_id: ctx.order.gym_id };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    locale: "fr",
    client_reference_id: ctx.order.id,
    // Moyens de paiement actifs dans le tableau de bord Stripe (carte, prélèvement SEPA).
    line_items: ctx.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: ctx.order.currency,
        unit_amount: item.unit_price_cents,
        product_data: { name: item.unit ? `${item.name} (${item.unit})` : item.name },
      },
    })),
    metadata,
    payment_intent_data: { metadata, description: `Commande ${ctx.order.reference}` },
    success_url: withParam(input.returnUrl, "paiement", "ok"),
    cancel_url: input.returnUrl,
  });
  return json({ url: session.url });
}

/**
 * Engagement dans un achat groupé (gérant). Sans carte enregistrée : URL de Checkout en mode
 * « setup » (aucun débit) ; sinon la nouvelle quantité suffit (`url: null`).
 */
export async function marketplaceCommit(
  stripe: Stripe,
  admin: SupabaseClient,
  user: SupabaseClient,
  input: { campaignId: string; gymId: string; quantity: number; returnUrl: string },
): Promise<Response> {
  const { data, error } = await user.rpc("mp_commit", {
    p_campaign_id: input.campaignId,
    p_gym_id: input.gymId,
    p_quantity: input.quantity,
  });
  if (error) return fail(sqlError(error));
  const ctx = data as CommitResult;
  if (ctx.commitment.status !== "pending_card") {
    return json({ url: null, status: ctx.commitment.status });
  }
  const customer = await ensureGymCustomer(stripe, admin, ctx.gym, ctx.customer_id);
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer,
    locale: "fr",
    currency: "eur",
    metadata: { kind: "mp_commitment", commitment_id: ctx.commitment.id },
    setup_intent_data: {
      metadata: { kind: "mp_commitment", commitment_id: ctx.commitment.id },
      description: `Achat groupé : ${ctx.campaign.title}`,
    },
    success_url: withParam(input.returnUrl, "engagement", "ok"),
    cancel_url: input.returnUrl,
  });
  return json({ url: session.url, status: ctx.commitment.status });
}

/**
 * Clôture d'un achat groupé (admin) : la base crée les commandes au palier atteint, puis chaque
 * salle est débitée hors session sur sa carte enregistrée. Un refus laisse la commande « à
 * payer » (le webhook marque l'engagement en échec) ; le gérant la règle par Checkout.
 */
export async function marketplaceCloseCampaign(
  stripe: Stripe,
  user: SupabaseClient,
  input: { campaignId: string },
): Promise<Response> {
  const { data, error } = await user.rpc("mp_close_campaign", { p_campaign_id: input.campaignId });
  if (error) return fail(sqlError(error));
  const result = data as CloseResult;
  let charged = 0;
  let failed = 0;
  for (const charge of result.charges) {
    if (!charge.customer_id || !charge.payment_method_id) {
      failed += 1;
      continue;
    }
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: charge.amount_cents,
          currency: charge.currency,
          customer: charge.customer_id,
          payment_method: charge.payment_method_id,
          off_session: true,
          confirm: true,
          description: "Achat groupé",
          metadata: {
            kind: "marketplace",
            order_id: charge.order_id,
            gym_id: charge.gym_id,
            commitment_id: charge.commitment_id,
          },
        },
        // Un second clic ne débite pas deux fois la même commande.
        { idempotencyKey: `mp-order-${charge.order_id}` },
      );
      if (intent.status === "succeeded" || intent.status === "processing") charged += 1;
      else failed += 1;
    } catch (error) {
      console.error(
        "mp_close_campaign",
        charge.order_id,
        error instanceof Error ? error.message : error,
      );
      failed += 1;
    }
  }
  return json({ status: result.status, totalQty: result.total_qty, charged, failed });
}
