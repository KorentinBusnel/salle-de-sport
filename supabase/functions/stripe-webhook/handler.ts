import { fail, json } from "../_shared/http.ts";
import { cryptoProvider, paymentMethodOf, type Stripe } from "../_shared/stripe.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

export type WebhookDeps = {
  stripe: Stripe | null;
  admin: SupabaseClient;
  secret: string | undefined;
};

/** Moyen de paiement d'un événement (facture ou PaymentIntent), lu sur le PaymentIntent. */
async function methodOf(stripe: Stripe, event: Stripe.Event): Promise<string | null> {
  const object = event.data.object as unknown as Record<string, unknown>;
  try {
    if (event.type.startsWith("payment_intent.")) {
      return paymentMethodOf(object.payment_method_types as string[] | undefined);
    }
    if (event.type.startsWith("invoice.")) {
      // API récente : le PaymentIntent est dans invoice.payments ; ancienne : invoice.payment_intent.
      const payments = object.payments as
        { data?: { payment?: { payment_intent?: unknown } }[] } | undefined;
      const candidate = object.payment_intent ?? payments?.data?.[0]?.payment?.payment_intent;
      const intent = typeof candidate === "string" ? candidate : null;
      if (!intent) return null;
      const pi = await stripe.paymentIntents.retrieve(intent);
      return paymentMethodOf(pi.payment_method_types);
    }
  } catch {
    // Moyen inconnu : la base retient « carte » par défaut.
  }
  return null;
}

/**
 * Webhook Stripe : signature vérifiée, puis l'événement est appliqué par la base
 * (apply_stripe_event : une seule fois par event.id, dans une transaction).
 */
export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (request.method !== "POST") return fail("method_not_allowed", 405);
  if (!deps.stripe || !deps.secret) return fail("stripe_not_configured", 503);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail("invalid_signature", 400);
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await deps.stripe.webhooks.constructEventAsync(
      body,
      signature,
      deps.secret,
      undefined,
      cryptoProvider,
    );
  } catch {
    return fail("invalid_signature", 400);
  }

  const method = await methodOf(deps.stripe, event);
  const { data, error } = await deps.admin.rpc("apply_stripe_event", {
    p_event: JSON.parse(body),
    ...(method ? { p_method: method } : {}),
  });
  if (error) {
    // 500 : Stripe renverra l'événement plus tard (il n'a pas été enregistré).
    console.error("stripe-webhook", event.type, error.message);
    return fail("unexpected", 500);
  }
  return json({ received: true, result: data });
}
