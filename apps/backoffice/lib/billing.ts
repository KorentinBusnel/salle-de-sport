import "server-only";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type BillingRequest =
  | { action: "sync_plan"; planId: string }
  | { action: "sync_promo"; promoId: string }
  | { action: "refund"; paymentId: string }
  | { action: "mp_checkout"; orderId: string; returnUrl: string }
  | {
      action: "mp_commit";
      campaignId: string;
      gymId: string;
      quantity: number;
      returnUrl: string;
    }
  | { action: "mp_close_campaign"; campaignId: string };

/**
 * Appelle l'Edge Function « billing » au nom de l'utilisateur connecté (son jeton de session) :
 * aucune clé Stripe côté Next. Renvoie le code d'erreur de la fonction (`stripe_not_configured`,
 * `forbidden`, `not_refundable`…) ou `unexpected`. En cas de succès, `data` est la réponse
 * (adresse de Stripe Checkout, bilan d'une clôture…).
 */
export async function callBilling(
  body: BillingRequest,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("billing", { body });
  if (!error) return { ok: true, data };
  if (error instanceof FunctionsHttpError) {
    // Fonction pas encore déployée sur ce projet : même état que des clés absentes.
    if ((error.context as Response).status === 404)
      return { ok: false, error: "stripe_not_configured" };
    const payload = (await (error.context as Response).json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (typeof payload?.error === "string") return { ok: false, error: payload.error };
  }
  return { ok: false, error: "unexpected" };
}
