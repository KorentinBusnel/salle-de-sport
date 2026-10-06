import { bookingErrorCode } from "@salle/shared";
import type { MessageKey } from "@/lib/i18n";

const KNOWN = [
  "stripe_not_configured",
  "forbidden",
  "plan_not_found",
  "payment_not_found",
  "not_refundable",
  "not_authenticated",
  "stripe_error",
] as const;

/**
 * Code renvoyé par l'Edge Function « billing » → message traduit : erreur de paiement connue, sinon
 * code métier de la base relayé par la fonction (`mp_campaign_closed`…), sinon générique.
 */
export function stripeErrorKey(code: string): MessageKey {
  const known = KNOWN.find((k) => k === code);
  if (known) return `stripeErrors.${known}`;
  const business = bookingErrorCode({ message: code });
  return business ? `bookingErrors.${business}` : "stripeErrors.unexpected";
}
