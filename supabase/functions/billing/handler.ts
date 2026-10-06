import { z } from "zod";
import { canCancelSubscription } from "../../../packages/shared/src/billing.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import type { Stripe } from "../_shared/stripe.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

export type BillingDeps = {
  stripe: Stripe | null;
  admin: SupabaseClient;
  user: (authorization: string) => SupabaseClient;
  /** Version d'API des clés éphémères (Payment Sheet). */
  apiVersion: string;
  now: () => Date;
};

type Context = {
  member: {
    id: string;
    gym_id: string;
    email: string | null;
    name: string;
    stripe_customer_id: string | null;
  };
  plan: {
    id: string;
    name: string;
    type: "recurring" | "pack" | "single";
    price_cents: number;
    currency: string;
    billing_interval: "month" | "year" | null;
    credits: number | null;
    stripe_product_id: string | null;
    stripe_price_id: string | null;
  };
  final_cents: number;
  promo: {
    id: string;
    code: string;
    kind: "percent" | "amount";
    value: number;
    stripe_coupon_id: string | null;
  } | null;
};

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("payment_sheet"),
    planId: z.guid(),
    promoCode: z.string().trim().max(30).optional(),
  }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("portal"), returnUrl: z.url().optional() }),
  z.object({ action: z.literal("sync_plan"), planId: z.guid() }),
  z.object({ action: z.literal("sync_promo"), promoId: z.guid() }),
  z.object({ action: z.literal("refund"), paymentId: z.guid() }),
]);

/** Code d'erreur SQL (raise exception '<code>') ou générique. */
function sqlError(error: { message?: string } | null): string {
  const code = error?.message?.trim() ?? "";
  return /^[a-z_]+$/.test(code) ? code : "unexpected";
}

/** Le gérant (ou admin) de la salle, d'après ses propres rôles (RLS : lecture de ses rôles). */
async function isManager(user: SupabaseClient, userId: string, gymId: string): Promise<boolean> {
  const { data } = await user
    .from("gym_roles")
    .select("role")
    .eq("gym_id", gymId)
    .eq("profile_id", userId);
  return (data ?? []).some(
    (row: { role: string }) => row.role === "manager" || row.role === "admin",
  );
}

/** Produit et prix Stripe d'une offre : créés au besoin, nouveau prix si le montant a changé. */
export async function syncPlan(
  stripe: Stripe,
  admin: SupabaseClient,
  plan: Context["plan"] & { gym_id: string },
): Promise<string> {
  let productId = plan.stripe_product_id;
  if (productId) {
    await stripe.products.update(productId, { name: plan.name });
  } else {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { plan_id: plan.id, gym_id: plan.gym_id },
    });
    productId = product.id;
  }
  let priceId = plan.stripe_price_id;
  if (priceId) {
    const price = await stripe.prices.retrieve(priceId);
    const interval = price.recurring?.interval ?? null;
    if (
      price.unit_amount !== plan.price_cents ||
      price.currency !== plan.currency ||
      interval !== plan.billing_interval
    ) {
      await stripe.prices.update(priceId, { active: false });
      priceId = null;
    }
  }
  if (!priceId) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.price_cents,
      currency: plan.currency,
      ...(plan.billing_interval ? { recurring: { interval: plan.billing_interval } } : {}),
      metadata: { plan_id: plan.id },
    });
    priceId = price.id;
  }
  await admin
    .from("plans")
    .update({ stripe_product_id: productId, stripe_price_id: priceId })
    .eq("id", plan.id);
  return priceId;
}

/** Coupon Stripe d'un code promo (appliqué à la première échéance d'un abonnement). */
export async function syncPromo(
  stripe: Stripe,
  admin: SupabaseClient,
  promo: NonNullable<Context["promo"]> & { gym_id: string },
): Promise<string> {
  const coupon = await stripe.coupons.create({
    name: promo.code,
    duration: "once",
    ...(promo.kind === "percent"
      ? { percent_off: promo.value }
      : { amount_off: promo.value, currency: "eur" }),
    metadata: { promo_code_id: promo.id, gym_id: promo.gym_id },
  });
  await admin.from("promo_codes").update({ stripe_coupon_id: coupon.id }).eq("id", promo.id);
  return coupon.id;
}

/** Client Stripe de l'adhérent, créé au premier achat et gardé sur sa fiche. */
async function ensureCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  ctx: Context,
): Promise<string> {
  if (ctx.member.stripe_customer_id) return ctx.member.stripe_customer_id;
  const customer = await stripe.customers.create({
    name: ctx.member.name,
    ...(ctx.member.email ? { email: ctx.member.email } : {}),
    metadata: { member_id: ctx.member.id, gym_id: ctx.member.gym_id },
  });
  await admin.from("members").update({ stripe_customer_id: customer.id }).eq("id", ctx.member.id);
  return customer.id;
}

/**
 * Paiements en ligne (Edge Function « billing »), toujours au nom de l'utilisateur connecté :
 * - adhérent : feuille de paiement (carnet, séance : paiement immédiat ; abonnement : carte ou
 *   SEPA),
 *   résiliation en fin de période après l'engagement, portail Stripe (moyen de paiement,
 *   factures) ;
 * - gérant : synchronisation d'une offre ou d'un code promo, remboursement.
 */
export async function handleBilling(request: Request, deps: BillingDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return fail("method_not_allowed", 405);
  const authorization = request.headers.get("authorization");
  if (!authorization) return fail("not_authenticated", 401);
  if (!deps.stripe) return fail("stripe_not_configured", 503);
  const stripe = deps.stripe;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input");
  const user = deps.user(authorization);
  const { data: auth } = await user.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail("not_authenticated", 401);
  const input = parsed.data;

  try {
    switch (input.action) {
      case "payment_sheet": {
        const { data, error } = await user.rpc("billing_checkout_context", {
          p_plan_id: input.planId,
          ...(input.promoCode ? { p_promo_code: input.promoCode } : {}),
        });
        if (error) return fail(sqlError(error));
        const ctx = data as Context;
        const customer = await ensureCustomer(stripe, deps.admin, ctx);
        const metadata = {
          member_id: ctx.member.id,
          plan_id: ctx.plan.id,
          gym_id: ctx.member.gym_id,
          ...(ctx.promo ? { promo_code_id: ctx.promo.id } : {}),
        };
        let clientSecret: string | null = null;

        if (ctx.plan.type === "recurring") {
          const price =
            ctx.plan.stripe_price_id ??
            (await syncPlan(stripe, deps.admin, { ...ctx.plan, gym_id: ctx.member.gym_id }));
          const coupon = ctx.promo
            ? (ctx.promo.stripe_coupon_id ??
              (await syncPromo(stripe, deps.admin, { ...ctx.promo, gym_id: ctx.member.gym_id })))
            : null;
          const subscription = await stripe.subscriptions.create({
            customer,
            items: [{ price }],
            payment_behavior: "default_incomplete",
            payment_settings: {
              save_default_payment_method: "on_subscription",
              payment_method_types: ["card", "sepa_debit"],
            },
            ...(coupon ? { discounts: [{ coupon }] } : {}),
            metadata,
            expand: ["latest_invoice.confirmation_secret"],
          });
          const invoice = subscription.latest_invoice as unknown as {
            confirmation_secret?: { client_secret?: string } | null;
          } | null;
          clientSecret = invoice?.confirmation_secret?.client_secret || null;
          await deps.admin.rpc("sync_stripe_subscription", { p_sub: subscription });
        } else {
          // Carnet et séance : la feuille de paiement n'offre pas les moyens différés (SEPA),
          // et les crédits ne sont ajoutés qu'au paiement réussi (webhook).
          const intent = await stripe.paymentIntents.create({
            amount: ctx.final_cents,
            currency: ctx.plan.currency,
            customer,
            automatic_payment_methods: { enabled: true },
            metadata: { ...metadata, kind: "pack" },
            description: ctx.plan.name,
          });
          clientSecret = intent.client_secret;
        }
        if (!clientSecret) return fail("unexpected", 500);
        const key = await stripe.ephemeralKeys.create(
          { customer },
          { apiVersion: deps.apiVersion },
        );
        return json({
          clientSecret,
          customerId: customer,
          ephemeralKey: key.secret ?? null,
          amountCents: ctx.final_cents,
          // Prélèvement SEPA proposé pour un abonnement seulement (accès dès la souscription).
          allowsDelayedPaymentMethods: ctx.plan.type === "recurring",
        });
      }

      case "cancel": {
        const { data: sub } = await user
          .from("subscriptions")
          .select("id, stripe_subscription_id, commitment_ends_at, members!inner(profile_id)")
          .eq("members.profile_id", userId)
          .not("stripe_subscription_id", "is", null)
          .in("status", ["active", "trialing", "past_due"])
          .limit(1)
          .maybeSingle();
        if (!sub?.stripe_subscription_id) return fail("subscription_not_found", 404);
        if (!canCancelSubscription(sub.commitment_ends_at, deps.now()))
          return fail("commitment_running");
        const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        await deps.admin.rpc("sync_stripe_subscription", { p_sub: updated });
        return json({ ok: true });
      }

      case "portal": {
        const { data: member } = await user
          .from("members")
          .select("stripe_customer_id")
          .eq("profile_id", userId)
          .not("stripe_customer_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (!member?.stripe_customer_id) return fail("no_stripe_customer", 404);
        const session = await stripe.billingPortal.sessions.create({
          customer: member.stripe_customer_id,
          ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
        });
        return json({ url: session.url });
      }

      case "sync_plan": {
        const { data: plan } = await user
          .from("plans")
          .select(
            "id, gym_id, name, type, price_cents, currency, billing_interval, credits, stripe_product_id, stripe_price_id",
          )
          .eq("id", input.planId)
          .maybeSingle();
        if (!plan) return fail("plan_not_found", 404);
        if (!(await isManager(user, userId, plan.gym_id))) return fail("forbidden", 403);
        const price = await syncPlan(stripe, deps.admin, plan);
        return json({ priceId: price });
      }

      case "sync_promo": {
        const { data: promo } = await user
          .from("promo_codes")
          .select("id, gym_id, code, kind, value, stripe_coupon_id")
          .eq("id", input.promoId)
          .maybeSingle();
        // La RLS ne montre les codes qu'au gérant.
        if (!promo) return fail("forbidden", 403);
        const coupon = await syncPromo(stripe, deps.admin, promo);
        return json({ couponId: coupon });
      }

      case "refund": {
        const { data: payment } = await user
          .from("payments")
          .select("id, gym_id, status, stripe_payment_intent_id")
          .eq("id", input.paymentId)
          .maybeSingle();
        if (!payment) return fail("payment_not_found", 404);
        if (!(await isManager(user, userId, payment.gym_id))) return fail("forbidden", 403);
        if (payment.status !== "succeeded" || !payment.stripe_payment_intent_id)
          return fail("not_refundable");
        // Le webhook charge.refunded marque le paiement et retire les crédits restants.
        await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id });
        return json({ ok: true });
      }
    }
  } catch (error) {
    console.error("billing", input.action, error instanceof Error ? error.message : error);
    return fail("stripe_error", 502);
  }
}
