import { describe, expect, it } from "vitest";
import {
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
