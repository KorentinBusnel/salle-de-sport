import { describe, expect, it } from "vitest";
import { stripeErrorKey } from "./stripe-errors";

describe("stripeErrorKey", () => {
  it("traduit les codes connus", () => {
    expect(stripeErrorKey("stripe_not_configured")).toBe("stripeErrors.stripe_not_configured");
    expect(stripeErrorKey("not_refundable")).toBe("stripeErrors.not_refundable");
  });
  it("relaie les codes métier de la base", () => {
    expect(stripeErrorKey("mp_campaign_closed")).toBe("bookingErrors.mp_campaign_closed");
    expect(stripeErrorKey("forbidden")).toBe("stripeErrors.forbidden");
  });
  it("replie les codes inconnus sur le message générique", () => {
    expect(stripeErrorKey("boom")).toBe("stripeErrors.unexpected");
  });
});
