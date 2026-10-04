import { describe, expect, it } from "vitest";
import { occupancy, sessionPhase } from "./display.ts";

describe("sessionPhase", () => {
  const start = new Date("2026-10-05T16:30:00Z");
  const end = new Date("2026-10-05T17:30:00Z");

  it("distingue à venir, en cours et terminée", () => {
    expect(sessionPhase(start, end, new Date("2026-10-05T16:29:59Z"))).toBe("upcoming");
    expect(sessionPhase(start, end, start)).toBe("live");
    expect(sessionPhase(start, end, new Date("2026-10-05T17:29:59Z"))).toBe("live");
    expect(sessionPhase(start, end, end)).toBe("past");
  });
});

describe("occupancy", () => {
  it("borne le taux et gère une capacité nulle", () => {
    expect(occupancy(16, 8)).toBe(0.5);
    expect(occupancy(16, 20)).toBe(1);
    expect(occupancy(0, 3)).toBe(0);
  });
});
