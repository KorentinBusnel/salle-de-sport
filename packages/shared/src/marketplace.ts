import type { Tone } from "./display.ts";

export type PriceTier = { min_qty: number; unit_price_cents: number };

/**
 * Prix unitaire d'une ligne : palier le plus haut atteint par la quantité, sinon prix réseau.
 * Même règle que la fonction SQL mp_unit_price (qui fige le prix à la commande).
 */
export function mpUnitPrice(
  priceCents: number,
  tiers: readonly PriceTier[],
  quantity: number,
): number {
  let best: PriceTier | undefined;
  for (const tier of tiers)
    if (tier.min_qty <= quantity && (!best || tier.min_qty > best.min_qty)) best = tier;
  return best ? best.unit_price_cents : priceCents;
}

/** Prochain palier à atteindre (pour « encore N pour passer à X ») ou null. */
export function mpNextTier(tiers: readonly PriceTier[], quantity: number): PriceTier | null {
  let next: PriceTier | null = null;
  for (const tier of tiers)
    if (tier.min_qty > quantity && (!next || tier.min_qty < next.min_qty)) next = tier;
  return next;
}

/** Économie par rapport au prix public, en pourcentage entier (null sans prix public). */
export function mpSavingPercent(listCents: number | null, priceCents: number): number | null {
  if (!listCents || listCents <= priceCents) return null;
  return Math.round(((listCents - priceCents) / listCents) * 100);
}

export const MP_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "ordered",
  "shipped",
  "delivered",
  "received",
  "cancelled",
] as const;
export type MpOrderStatus = (typeof MP_ORDER_STATUSES)[number];

export const MP_ORDER_STATUS_TONE: Record<MpOrderStatus, Tone> = {
  pending_payment: "warning",
  paid: "brand",
  ordered: "brand",
  shipped: "brand",
  delivered: "success",
  received: "success",
  cancelled: "neutral",
};

export const MP_QUOTE_STATUSES = [
  "requested",
  "answered",
  "accepted",
  "declined",
  "expired",
] as const;
export type MpQuoteStatus = (typeof MP_QUOTE_STATUSES)[number];

export const MP_QUOTE_STATUS_TONE: Record<MpQuoteStatus, Tone> = {
  requested: "warning",
  answered: "brand",
  accepted: "success",
  declined: "neutral",
  expired: "neutral",
};
