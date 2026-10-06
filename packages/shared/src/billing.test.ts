import { describe, expect, it } from "vitest";
import {
  canCancelSubscription,
  discountedPrice,
  eurosToCents,
  formatMoney,
  formatPrice,
  monthlyEquivalent,
  planSchema,
  promoSchema,
} from "./billing.ts";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("formatMoney / formatPrice", () => {
  it("sans décimales inutiles", () => {
    expect(nbsp(formatMoney(7900))).toBe("79 €");
    expect(nbsp(formatMoney(3250))).toBe("32,50 €");
    expect(nbsp(formatMoney(123456))).toBe("1 234,56 €");
  });
  it("par période", () => {
    expect(nbsp(formatPrice({ price_cents: 7900, billing_interval: "month" }))).toBe("79 € / mois");
    expect(nbsp(formatPrice({ price_cents: 18000, billing_interval: null }))).toBe("180 €");
  });
});

describe("calculs", () => {
  it("équivalent mensuel", () => {
    expect(monthlyEquivalent(60000, "year")).toBe(5000);
    expect(monthlyEquivalent(7900, "month")).toBe(7900);
  });
  it("remise", () => {
    expect(discountedPrice(18000, { kind: "percent", value: 20 })).toBe(14400);
    expect(discountedPrice(1000, { kind: "amount", value: 1500 })).toBe(0);
    expect(discountedPrice(1000, null)).toBe(1000);
  });
  it("résiliation après l'engagement", () => {
    const now = new Date("2026-10-06T10:00:00Z");
    expect(canCancelSubscription(null, now)).toBe(true);
    expect(canCancelSubscription("2026-12-01T00:00:00Z", now)).toBe(false);
    expect(canCancelSubscription("2026-10-01T00:00:00Z", now)).toBe(true);
  });
  it("saisie en euros", () => {
    expect(eurosToCents.parse("32,50")).toBe(3250);
    expect(eurosToCents.safeParse("-1").success).toBe(false);
  });
});

describe("schémas", () => {
  it("un abonnement exige une périodicité, un carnet des crédits", () => {
    expect(planSchema.safeParse({ name: "A", type: "recurring", price_cents: 1 }).success).toBe(false);
    expect(planSchema.safeParse({ name: "C", type: "pack", price_cents: 1 }).success).toBe(false);
    expect(planSchema.safeParse({ name: "C", type: "pack", price_cents: 1, credits: 10 }).success).toBe(true);
  });
  it("code promo normalisé, pourcentage borné", () => {
    expect(promoSchema.parse({ code: " rentree ", kind: "percent", value: 20 }).code).toBe("RENTREE");
    expect(promoSchema.safeParse({ code: "X1X", kind: "percent", value: 120 }).success).toBe(false);
  });
});
