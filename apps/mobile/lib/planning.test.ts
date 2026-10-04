import { describe, expect, it } from "vitest";
import { planningDays, spotsText } from "./planning";

describe("planningDays", () => {
  it("liste 7 jours locaux à partir d'aujourd'hui", () => {
    // Dimanche 4 octobre 2026, 10 h à Paris.
    const days = planningDays(new Date("2026-10-04T08:00:00Z"), "Europe/Paris");
    expect(days.map((d) => d.label)).toEqual([
      "Aujourd'hui",
      "Demain",
      "Mar. 6",
      "Mer. 7",
      "Jeu. 8",
      "Ven. 9",
      "Sam. 10",
    ]);
    expect(days[1]?.start.toISOString()).toBe("2026-10-04T22:00:00.000Z");
  });

  it("traverse le passage à l'heure d'hiver sans sauter de jour", () => {
    const days = planningDays(new Date("2026-10-24T10:00:00Z"), "Europe/Paris", 3);
    expect(days.map((d) => d.start.toISOString())).toEqual([
      "2026-10-23T22:00:00.000Z",
      "2026-10-24T22:00:00.000Z",
      "2026-10-25T23:00:00.000Z",
    ]);
  });
});

describe("spotsText", () => {
  it("affiche les places restantes", () => {
    expect(spotsText(16, 12, 0)).toEqual({ full: false, text: "4 places" });
    expect(spotsText(16, 15, 0)).toEqual({ full: false, text: "1 place" });
  });

  it("signale une séance complète et sa liste d'attente", () => {
    expect(spotsText(12, 12, 0)).toEqual({ full: true, text: "Complet" });
    expect(spotsText(12, 12, 3)).toEqual({ full: true, text: "Complet · 3 en attente" });
  });
});
