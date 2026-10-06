import Stripe from "stripe";

/**
 * Client Stripe des Edge Functions (clé secrète lue côté serveur seulement). Sans clé : null,
 * et les fonctions répondent « stripe_not_configured » au lieu d'échouer. STRIPE_API_BASE
 * (tests) dirige les appels vers stripe-mock.
 */
export function createStripe(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  const base = Deno.env.get("STRIPE_API_BASE");
  const url = base ? new URL(base) : null;
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    ...(url
      ? {
          host: url.hostname,
          port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
          protocol: url.protocol.replace(":", "") as "http" | "https",
        }
      : {}),
  });
}

/** Vérification de signature d'un webhook (Web Crypto, asynchrone sous Deno). */
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Moyen de paiement d'un PaymentIntent, dans le vocabulaire de la base. */
export function paymentMethodOf(
  types: readonly string[] | null | undefined,
): "card" | "sepa_debit" | "other" {
  const type = types?.[0];
  return type === "card" ? "card" : type === "sepa_debit" ? "sepa_debit" : "other";
}

export type { Stripe };
