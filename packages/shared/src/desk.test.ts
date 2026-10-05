import { describe, expect, it } from "vitest";
import { deskShiftInputSchema, deskWindow, uncoveredIntervals } from "./desk.ts";

const iso = (h: number, m = 0) => new Date(Date.UTC(2030, 0, 15, h, m)).toISOString();
const hours = (intervals: { start: Date; end: Date }[]) =>
  intervals.map(
    (i) => `${i.start.toISOString().slice(11, 16)}-${i.end.toISOString().slice(11, 16)}`,
  );

describe("permanences à l'accueil", () => {
  const sessions = [
    { starts_at: iso(7), ends_at: iso(8) },
    { starts_at: iso(17, 30), ends_at: iso(18, 30) },
  ];

  it("plage : 30 min avant la première séance, 30 min après la dernière", () => {
    const window = deskWindow(sessions);
    expect(window).not.toBeNull();
    if (window) expect(hours([window])).toEqual(["06:30-19:00"]);
    expect(deskWindow([])).toBeNull();
  });

  it("signale les trous, ignore les chevauchements et les trous de moins de 15 min", () => {
    const shifts = [
      { starts_at: iso(6, 30), ends_at: iso(12) },
      { starts_at: iso(11), ends_at: iso(14) },
      { starts_at: iso(14, 10), ends_at: iso(16) },
    ];
    expect(hours(uncoveredIntervals(deskWindow(sessions), shifts))).toEqual(["16:00-19:00"]);
  });

  it("toute la plage est un trou sans permanence ; rien sans séance", () => {
    expect(hours(uncoveredIntervals(deskWindow(sessions), []))).toEqual(["06:30-19:00"]);
    expect(uncoveredIntervals(null, [])).toEqual([]);
  });

  it("valide la saisie : fin après le début", () => {
    const base = { profileId: "d0000001-0000-0000-0000-000000000001", date: "2030-01-15" };
    expect(deskShiftInputSchema.safeParse({ ...base, start: "16:00", end: "21:00" }).success).toBe(
      true,
    );
    expect(deskShiftInputSchema.safeParse({ ...base, start: "16:00", end: "15:00" }).success).toBe(
      false,
    );
    expect(deskShiftInputSchema.safeParse({ ...base, start: "25:00", end: "26:00" }).success).toBe(
      false,
    );
  });
});
