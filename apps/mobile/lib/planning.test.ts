import { describe, expect, it } from "vitest";
import { groupSessionsByDay, type PlanningSession } from "./planning";

const session = (id: string, startsAt: string): PlanningSession => ({
  id,
  starts_at: startsAt,
  ends_at: startsAt,
  capacity: 16,
  disciplines: { name: "CrossFit", color: "#dc2626" },
  coaches: { display_name: "Julien M." },
});

describe("groupSessionsByDay", () => {
  // Samedi 4 octobre 2026, 10 h à Paris.
  const now = new Date("2026-10-04T08:00:00Z");

  it("regroupe par jour local et nomme aujourd'hui et demain", () => {
    const days = groupSessionsByDay(
      [
        session("c", "2026-10-06T16:30:00Z"),
        session("a", "2026-10-04T16:30:00Z"),
        session("b", "2026-10-05T05:00:00Z"),
      ],
      "Europe/Paris",
      now,
    );
    expect(days.map((d) => d.title)).toEqual(["Aujourd'hui", "Demain", "Mardi 6 octobre"]);
    expect(days.map((d) => d.data.map((s) => s.id))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("rattache une séance à 0 h 30 heure locale au lendemain", () => {
    // 22 h 30 UTC le 4 = 0 h 30 le 5 à Paris.
    const days = groupSessionsByDay([session("late", "2026-10-04T22:30:00Z")], "Europe/Paris", now);
    expect(days[0]?.title).toBe("Demain");
  });
});
