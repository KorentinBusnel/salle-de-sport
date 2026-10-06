import { describe, expect, it } from "vitest";
import { mpNextTier, mpSavingPercent, mpUnitPrice } from "./marketplace.ts";

const tiers = [
  { min_qty: 10, unit_price_cents: 3300 },
  { min_qty: 50, unit_price_cents: 3000 },
];

describe("marketplace", () => {
  it("palier le plus haut atteint, sinon prix réseau", () => {
    expect(mpUnitPrice(3500, tiers, 9)).toBe(3500);
    expect(mpUnitPrice(3500, tiers, 10)).toBe(3300);
    expect(mpUnitPrice(3500, tiers, 80)).toBe(3000);
    expect(mpUnitPrice(3500, [], 80)).toBe(3500);
  });
  it("prochain palier", () => {
    expect(mpNextTier(tiers, 3)?.min_qty).toBe(10);
    expect(mpNextTier(tiers, 10)?.min_qty).toBe(50);
    expect(mpNextTier(tiers, 50)).toBeNull();
  });
  it("économie par rapport au prix public", () => {
    expect(mpSavingPercent(4800, 3600)).toBe(25);
    expect(mpSavingPercent(null, 3600)).toBeNull();
    expect(mpSavingPercent(3000, 3600)).toBeNull();
  });
});
