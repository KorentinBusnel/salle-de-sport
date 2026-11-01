import { describe, expect, it } from "vitest";
import { countActions, remindedToday } from "./home-actions";

const counts = { toCheck: 2, deskGaps: 1, crmTodo: 15, unpaid: 10 };

describe("countActions", () => {
  it("gérant : pointages, permanences, CRM et impayés", () => {
    expect(countActions({ manager: true, frontDesk: true }, counts)).toBe(28);
  });

  it("accueil : pointages et impayés, pas les permanences à assigner", () => {
    expect(countActions({ manager: false, frontDesk: true }, counts)).toBe(12);
  });

  it("coach : ses pointages seulement", () => {
    expect(countActions({ manager: false, frontDesk: false }, counts)).toBe(2);
    expect(countActions({ manager: false, frontDesk: false }, { ...counts, toCheck: 0 })).toBe(0);
  });
});

describe("remindedToday", () => {
  const tz = "Europe/Paris";
  const now = new Date("2026-11-02T10:00:00Z"); // lundi 2 novembre, 11 h à Paris

  it("jamais relancé : relance possible", () => {
    expect(remindedToday(null, now, tz)).toBe(false);
  });

  it("relancé ce jour-là (heure de la salle) : plus de relance avant demain", () => {
    expect(remindedToday("2026-11-02T07:30:00Z", now, tz)).toBe(true);
    expect(remindedToday("2026-11-01T23:30:00Z", now, tz)).toBe(true); // 0 h 30 le 2 à Paris
  });

  it("relancé la veille : relance possible", () => {
    expect(remindedToday("2026-11-01T09:00:00Z", now, tz)).toBe(false);
  });

  it("jour UTC de la base encore en cours juste après minuit à Paris : relance refusée", () => {
    const afterMidnight = new Date("2026-11-01T23:30:00Z"); // 0 h 30 le 2 à Paris
    expect(remindedToday("2026-11-01T22:00:00Z", afterMidnight, tz)).toBe(true);
  });
});
