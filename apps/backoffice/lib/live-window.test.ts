import { describe, expect, it } from "vitest";
import { liveWindow } from "./live-window";

const now = new Date("2026-11-06T10:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

describe("liveWindow", () => {
  it("ne relit rien quand aucune séance n'est en cours ni proche", () => {
    expect(liveWindow([{ starts_at: at(-3), ends_at: at(-2), phase: "past" }], now)).toEqual({
      pollUntil: null,
      resumeAt: null,
    });
  });

  it("relit jusqu'à la fin de la séance en cours", () => {
    expect(liveWindow([{ starts_at: at(-0.5), ends_at: at(0.5), phase: "live" }], now)).toEqual({
      pollUntil: at(0.5),
      resumeAt: null,
    });
  });

  it("compte une séance qui commence dans l'heure, et reprend une heure avant la suivante", () => {
    expect(
      liveWindow(
        [
          { starts_at: at(0.75), ends_at: at(1.75), phase: "upcoming" },
          { starts_at: at(4), ends_at: at(5), phase: "upcoming" },
          { starts_at: at(6), ends_at: at(7), phase: "upcoming" },
        ],
        now,
      ),
    ).toEqual({ pollUntil: at(1.75), resumeAt: at(3) });
  });

  it("garde la fin la plus tardive quand plusieurs séances se chevauchent", () => {
    expect(
      liveWindow(
        [
          { starts_at: at(-0.5), ends_at: at(1), phase: "live" },
          { starts_at: at(0.25), ends_at: at(0.75), phase: "upcoming" },
        ],
        now,
      ).pollUntil,
    ).toBe(at(1));
  });
});
