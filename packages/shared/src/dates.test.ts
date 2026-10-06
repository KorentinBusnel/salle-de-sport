import { describe, expect, it } from "vitest";
import {
  dateRangePreset,
  shiftDateKey,
  monthRange,
  zonedInstant,
  zonedDateKey,
  zonedDayRange,
  zonedMinutesOfDay,
  zonedStartOfDateKey,
  zonedWeek,
} from "./dates.ts";

const PARIS = "Europe/Paris";
const hours = (r: { start: Date; end: Date }) => (r.end.getTime() - r.start.getTime()) / 3_600_000;

describe("zonedDayRange", () => {
  it("donne une journée de 24 h en heure d'été", () => {
    const range = zonedDayRange(new Date("2026-07-14T10:00:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-07-13T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("donne une journée de 24 h en heure d'hiver", () => {
    const range = zonedDayRange(new Date("2026-01-15T12:00:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(hours(range)).toBe(24);
  });

  it("gère le passage à l'heure d'été (23 h)", () => {
    const range = zonedDayRange(new Date("2026-03-29T12:00:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(hours(range)).toBe(23);
  });

  it("gère le passage à l'heure d'hiver (25 h)", () => {
    const range = zonedDayRange(new Date("2026-10-25T12:00:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(hours(range)).toBe(25);
  });

  it("rattache 23 h 30 heure locale au bon jour", () => {
    // 2026-07-14 23:30 à Paris = 21:30 UTC, toujours le 14 juillet.
    const range = zonedDayRange(new Date("2026-07-14T21:30:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-07-13T22:00:00.000Z");
  });

  it("rattache 0 h 30 heure locale au jour suivant", () => {
    // 2026-07-15 00:30 à Paris = 2026-07-14 22:30 UTC.
    const range = zonedDayRange(new Date("2026-07-14T22:30:00Z"), PARIS);
    expect(range.start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });
});

describe("zonedWeek", () => {
  it("commence le lundi à minuit heure locale", () => {
    // Mercredi 7 octobre 2026.
    const week = zonedWeek(new Date("2026-10-07T12:00:00Z"), PARIS);
    expect(week.days.map((d) => d.key)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week.start.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });

  it("dure 169 h la semaine du passage à l'heure d'hiver", () => {
    const week = zonedWeek(new Date("2026-10-22T12:00:00Z"), PARIS);
    expect((week.end.getTime() - week.start.getTime()) / 3_600_000).toBe(169);
    expect(week.days[6]?.key).toBe("2026-10-25");
  });

  it("rattache le dimanche soir à la bonne semaine", () => {
    // Dimanche 11 octobre, 23 h 30 à Paris.
    const week = zonedWeek(new Date("2026-10-11T21:30:00Z"), PARIS);
    expect(week.days[0]?.key).toBe("2026-10-05");
  });
});

describe("zonedDateKey et zonedMinutesOfDay", () => {
  it("donnent la date et l'heure locales", () => {
    const instant = new Date("2026-10-05T16:30:00Z");
    expect(zonedDateKey(instant, PARIS)).toBe("2026-10-05");
    expect(zonedMinutesOfDay(instant, PARIS)).toBe(18 * 60 + 30);
  });

  it("zonedStartOfDateKey renvoie minuit local", () => {
    expect(zonedStartOfDateKey("2026-10-25", PARIS).toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("monthRange", () => {
  it("donne les bornes du mois et les mois voisins", () => {
    expect(monthRange("2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
      previous: "2026-01",
      next: "2026-03",
    });
    expect(monthRange("2028-02")?.to).toBe("2028-02-29");
    expect(monthRange("2026-12")?.next).toBe("2027-01");
    expect(monthRange("2026-01")?.previous).toBe("2025-12");
  });

  it("refuse un mois invalide", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("oct")).toBeNull();
  });
});

describe("zonedInstant", () => {
  it("convertit une heure locale en instant", () => {
    expect(zonedInstant("2026-10-06", 18 * 60 + 30, PARIS).toISOString()).toBe(
      "2026-10-06T16:30:00.000Z",
    );
  });

  it("garde l'heure murale les jours de changement d'heure", () => {
    // 25 octobre 2026 : 3 h → 2 h. 29 mars 2026 : 2 h → 3 h.
    expect(zonedInstant("2026-10-25", 18 * 60, PARIS).toISOString()).toBe(
      "2026-10-25T17:00:00.000Z",
    );
    expect(zonedInstant("2026-03-29", 9 * 60, PARIS).toISOString()).toBe(
      "2026-03-29T07:00:00.000Z",
    );
  });
});

describe("shiftDateKey / dateRangePreset", () => {
  it("décale une date civile, y compris d'un mois et d'une année à l'autre", () => {
    expect(shiftDateKey("2026-10-05", -6)).toBe("2026-09-29");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("2028-03-01", -1)).toBe("2028-02-29");
    // Changement d'heure : sans effet sur une date civile.
    expect(shiftDateKey("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("raccourcis bornes incluses", () => {
    expect(dateRangePreset("last7", "2026-10-05")).toEqual({
      from: "2026-09-29",
      to: "2026-10-05",
    });
    expect(dateRangePreset("last30", "2026-10-05")).toEqual({
      from: "2026-09-06",
      to: "2026-10-05",
    });
    expect(dateRangePreset("thisMonth", "2026-10-05")).toEqual({
      from: "2026-10-01",
      to: "2026-10-05",
    });
    expect(dateRangePreset("lastMonth", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(dateRangePreset("thisYear", "2026-10-05")).toEqual({
      from: "2026-01-01",
      to: "2026-10-05",
    });
  });
});
