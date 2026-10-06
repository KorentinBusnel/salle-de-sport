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

/** Code renvoyé par l'Edge Function « billing » → message traduit (inconnu : générique). */
export function stripeErrorKey(code: string): MessageKey {
  const known = KNOWN.find((k) => k === code);
  return `stripeErrors.${known ?? "unexpected"}`;
}
