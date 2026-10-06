import { bookingErrorCode } from "@salle/shared";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { type MessageKey, t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

/** Achat dans l'app possible : clé publiable Stripe présente dans cette version de l'app. */
export const onlinePaymentEnabled = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY !== undefined;

export type PaymentSheetParams = {
  clientSecret: string;
  customerId: string;
  ephemeralKey: string | null;
  amountCents: number;
  /** Prélèvement SEPA proposé (abonnements uniquement). */
  allowsDelayedPaymentMethods: boolean;
};

type BillingBody =
  | { action: "payment_sheet"; planId: string; promoCode?: string }
  | { action: "cancel" }
  | { action: "portal"; returnUrl?: string };

/**
 * Appelle l'Edge Function « billing » avec la session de l'adhérent. En cas d'échec, renvoie le
 * message traduit (code métier de la fonction ou de la base, sinon message générique).
 */
export async function callBilling<T>(
  body: BillingBody,
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  const { data, error } = await supabase.functions.invoke<T>("billing", { body });
  if (!error && data) return { data, error: null };
  let code: string | null = null;
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    if (response.status === 404) code = "stripe_not_configured";
    else {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      code = typeof payload?.error === "string" ? payload.error : null;
    }
  }
  const known = bookingErrorCode({ message: code ?? "" });
  const key: MessageKey = known ? `bookingErrors.${known}` : "common.unexpectedError";
  return { data: null, error: t(key) };
}
