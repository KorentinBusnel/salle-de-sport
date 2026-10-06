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
      late_booking_minutes: 0,
      attendance_opens_minutes_before: null,
      allow_attendance_reset: false,
      manager_can_remove_credits: false,
      staff_can_suspend_members: false,
      staff_can_create_members: false,
      staff_can_sell: false,
    });
    expect(parseGymSettings(null).max_upcoming_bookings).toBe(5);
  });

  it("garde les valeurs valides et remplace les invalides", () => {
    const settings = parseGymSettings({
      max_upcoming_bookings: 3,
      cancellation_recommended_hours: "x",
      late_booking_minutes: 10,
      attendance_opens_minutes_before: 30,
      allow_attendance_reset: "oui",
      staff_can_create_members: true,
    });
    expect(settings).toMatchObject({
      max_upcoming_bookings: 3,
      cancellation_recommended_hours: 2,
      late_booking_minutes: 10,
      attendance_opens_minutes_before: 30,
      allow_attendance_reset: false,
      staff_can_create_members: true,
    });
    expect(parseGymSettings({ max_upcoming_bookings: 0 }).max_upcoming_bookings).toBe(5);
    expect(parseGymSettings({ late_booking_minutes: 500 }).late_booking_minutes).toBe(0);
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
