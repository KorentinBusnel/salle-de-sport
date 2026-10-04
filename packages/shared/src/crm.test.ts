import { describe, expect, it } from "vitest";
import { normalizeTags, parseSegmentFilters, segmentFiltersSchema } from "./crm.ts";

describe("segmentFiltersSchema", () => {
  it("accepte des filtres valides et refuse une clé inconnue", () => {
    expect(
      segmentFiltersSchema.safeParse({ statuses: ["active"], inactive_days: 14 }).success,
    ).toBe(true);
    expect(segmentFiltersSchema.safeParse({ inconnu: 1 }).success).toBe(false);
  });
});

describe("parseSegmentFilters", () => {
  it("garde les clés valides et ignore les autres", () => {
    expect(
      parseSegmentFilters({ statuses: ["active"], inactive_days: -3, email_consent: true, x: 1 }),
    ).toEqual({ statuses: ["active"], email_consent: true });
    expect(parseSegmentFilters(null)).toEqual({});
  });
});

describe("normalizeTags", () => {
  it("met en minuscules, réduit les espaces et dédoublonne", () => {
    expect(normalizeTags([" Hyrox ", "hyrox", "Course  à pied", ""])).toEqual([
      "hyrox",
      "course à pied",
    ]);
  });
});
