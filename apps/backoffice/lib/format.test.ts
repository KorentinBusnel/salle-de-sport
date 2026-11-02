import { describe, expect, it } from "vitest";
import { gymFormatters } from "@/lib/format";

describe("gymFormatters : premier du mois", () => {
  const format = gymFormatters("Europe/Paris");
  // 1er novembre 2026, 11 h à Paris.
  const first = "2026-11-01T10:00:00Z";

  it("écrit « 1er » dans les formats avec jour", () => {
    expect(format.longDay(first)).toBe("Dimanche 1er novembre");
    expect(format.longDayInline(first)).toBe("dimanche 1er novembre");
    expect(format.shortDay(first)).toBe("Dim. 1er");
    expect(format.dateTime(first)).toBe("1er nov., 11:00");
    expect(format.fullDate(first)).toBe("1er novembre 2026");
    expect(format.dateKey("2026-11-01")).toBe("1er nov. 2026");
    expect(format.dayKey("2026-11-01")).toBe("dimanche 1er novembre");
  });

  it("laisse les autres jours, 11 et 21 compris, et les formats sans jour", () => {
    expect(format.longDay("2026-11-11T10:00:00Z")).toBe("Mercredi 11 novembre");
    expect(format.dateKey("2026-11-21")).toBe("21 nov. 2026");
    expect(format.dayKey("2026-11-02")).toBe("lundi 2 novembre");
    expect(format.monthYear(first)).toBe("nov. 2026");
    expect(format.time(first)).toBe("11:00");
  });

  it("suit le fuseau de la salle : 23 h 30 à Paris le 31 octobre n'est pas le 1er", () => {
    expect(format.longDay("2026-10-31T22:30:00Z")).toBe("Samedi 31 octobre");
    expect(format.longDay("2026-10-31T23:30:00Z")).toBe("Dimanche 1er novembre");
  });
});
