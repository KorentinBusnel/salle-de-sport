import { z } from "zod";

/*
 * Offres, prix et codes promo (BRIEF §8, §12 du 2026-10-06). Les règles d'accès, de crédits
 * et de vente vivent en SQL (billing_core) ; ici : validation des saisies et affichage,
 * partagés par le back office, l'app et les Edge Functions (Deno).
 */

export const PLAN_TYPES = ["recurring", "pack", "single"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];
export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
/** Moyens d'une vente sur place (le prélèvement SEPA passe par Stripe). */
export const MANUAL_PAYMENT_METHODS = ["cash", "card", "other"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
export const PAYMENT_METHODS = ["card", "sepa_debit", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Montant saisi en euros (« 32,50 ») → centimes. */
export const eurosToCents = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const n = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      ctx.addIssue({ code: "custom", message: "amount" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

/** Offre telle que le gérant la saisit (mêmes contraintes que la table plans). */
export const planSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).nullable().default(null),
    type: z.enum(PLAN_TYPES),
    price_cents: z.number().int().min(0).max(10_000_000),
    billing_interval: z.enum(BILLING_INTERVALS).nullable().default(null),
    commitment_months: z.number().int().min(1).max(36).nullable().default(null),
    credits: z.number().int().min(1).max(500).nullable().default(null),
    validity_days: z.number().int().min(1).max(1095).nullable().default(null),
    audience: z.string().trim().max(60).nullable().default(null),
    requires_proof: z.boolean().default(false),
    all_disciplines: z.boolean().default(true),
    is_active: z.boolean().default(true),
  })
  .superRefine((plan, ctx) => {
    if (plan.type === "recurring" && !plan.billing_interval)
      ctx.addIssue({ code: "custom", path: ["billing_interval"], message: "required" });
    if (plan.type !== "recurring" && !plan.credits)
      ctx.addIssue({ code: "custom", path: ["credits"], message: "required" });
  });
export type PlanInput = z.input<typeof planSchema>;

/** Code promo : majuscules, chiffres, tiret ou souligné (3 à 30). */
export const promoCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/);

export const promoSchema = z
  .object({
    code: promoCodeSchema,
    kind: z.enum(["percent", "amount"]),
    value: z.number().int().min(1).max(10_000_000),
    starts_on: z.iso.date().nullable().default(null),
    ends_on: z.iso.date().nullable().default(null),
    max_redemptions: z.number().int().min(1).max(100_000).nullable().default(null),
    is_active: z.boolean().default(true),
  })
  .refine((p) => p.kind !== "percent" || p.value <= 100, { path: ["value"], message: "percent" })
  .refine((p) => !p.starts_on || !p.ends_on || p.ends_on >= p.starts_on, {
    path: ["ends_on"],
    message: "order",
  });

const moneyFormats = new Map<string, Intl.NumberFormat>();
/** Centimes → « 79 € », « 32,50 € » (pas de décimales inutiles). */
export function formatMoney(cents: number, currency = "eur"): string {
  const key = currency.toUpperCase();
  let format = moneyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat("fr-FR", { style: "currency", currency: key });
    moneyFormats.set(key, format);
  }
  const text = format.format(cents / 100);
  return cents % 100 === 0 ? text.replace(/,00(?=\s)/, "") : text;
}

/** Prix d'une offre : « 79 € / mois », « 180 € » (carnet ou séance). */
export function formatPrice(plan: {
  price_cents: number;
  currency?: string | undefined;
  billing_interval: BillingInterval | null;
}): string {
  const money = formatMoney(plan.price_cents, plan.currency);
  if (plan.billing_interval === "month") return `${money} / mois`;
  if (plan.billing_interval === "year") return `${money} / an`;
  return money;
}

/** Montant mensuel d'un abonnement (MRR) : un tarif annuel est ramené au mois. */
export function monthlyEquivalent(priceCents: number, interval: BillingInterval | null): number {
  return interval === "year" ? Math.round(priceCents / 12) : priceCents;
}

/** Prix après remise, jamais négatif (même calcul que private.discounted_price). */
export function discountedPrice(
  priceCents: number,
  promo: { kind: "percent" | "amount"; value: number } | null,
): number {
  if (!promo) return priceCents;
  return promo.kind === "percent"
    ? Math.max(0, Math.round((priceCents * (100 - promo.value)) / 100))
    : Math.max(0, priceCents - promo.value);
}

/** L'adhérent peut résilier seul une fois l'engagement terminé (effet en fin de période). */
export function canCancelSubscription(commitmentEndsAt: string | null, now: Date): boolean {
  return commitmentEndsAt === null || Date.parse(commitmentEndsAt) <= now.getTime();
}
