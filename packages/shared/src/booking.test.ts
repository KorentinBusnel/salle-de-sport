import { describe, expect, it } from "vitest";
import {
  bookingErrorCode,
  canCancel,
  isLateCancellation,
  parseGymSettings,
  spotsLeft,
} from "./booking.ts";

describe("parseGymSettings", () => {
  it("complète les valeurs absentes par les défauts", () => {
    expect(parseGymSettings({})).toEqual({
      max_upcoming_bookings: 5,
      cancellation_recommended_hours: 2,
    });
    expect(parseGymSettings(null).max_upcoming_bookings).toBe(5);
  });

  it("garde les valeurs valides et remplace les invalides", () => {
    expect(
      parseGymSettings({ max_upcoming_bookings: 3, cancellation_recommended_hours: "x" }),
    ).toEqual({ max_upcoming_bookings: 3, cancellation_recommended_hours: 2 });
    expect(parseGymSettings({ max_upcoming_bookings: 0 }).max_upcoming_bookings).toBe(5);
  });
});

describe("bookingErrorCode", () => {
  it("reconnaît un code métier", () => {
    expect(bookingErrorCode({ message: "no_credit" })).toBe("no_credit");
  });

  it("ignore les autres erreurs", () => {
    expect(bookingErrorCode({ message: "permission denied for function" })).toBeNull();
    expect(bookingErrorCode(null)).toBeNull();
  });
});

describe("règles d'affichage", () => {
  const now = new Date("2026-10-05T10:00:00Z");

  it("calcule les places restantes", () => {
    expect(spotsLeft(16, 12)).toBe(4);
    expect(spotsLeft(16, 18)).toBe(0);
  });

  it("autorise l'annulation jusqu'au début du cours", () => {
    expect(canCancel(new Date("2026-10-05T10:01:00Z"), now)).toBe(true);
    expect(canCancel(new Date("2026-10-05T10:00:00Z"), now)).toBe(false);
  });

  it("signale une annulation à moins de 2 h", () => {
    expect(isLateCancellation(new Date("2026-10-05T11:30:00Z"), now, 2)).toBe(true);
    expect(isLateCancellation(new Date("2026-10-05T12:30:00Z"), now, 2)).toBe(false);
    expect(isLateCancellation(new Date("2026-10-05T09:00:00Z"), now, 2)).toBe(false);
  });
});
