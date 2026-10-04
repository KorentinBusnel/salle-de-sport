import { describe, expect, it } from "vitest";
import { normalizeTags, parseSegmentFilters, pipelineMove, segmentFiltersSchema } from "./crm.ts";

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

describe("pipelineMove", () => {
  it("prospect ⇄ essai par le tag", () => {
    expect(pipelineMove("lead", "trial")).toEqual({ kind: "add_trial_tag" });
    expect(pipelineMove("trial", "lead")).toEqual({ kind: "remove_trial_tag" });
  });

  it("changements de statut, résiliation confirmée", () => {
    expect(pipelineMove("trial", "active")).toMatchObject({ status: "active", confirm: false });
    expect(pipelineMove("suspended", "active")).toMatchObject({ status: "active" });
    expect(pipelineMove("cancelled", "active")).toMatchObject({ status: "active" });
    expect(pipelineMove("active", "suspended")).toMatchObject({ status: "suspended" });
    expect(pipelineMove("active", "cancelled")).toMatchObject({
      status: "cancelled",
      confirm: true,
    });
    expect(pipelineMove("lead", "cancelled")).toMatchObject({ status: "cancelled", confirm: true });
  });

  it("refuse les retours en arrière et les sauts incohérents", () => {
    expect(pipelineMove("active", "lead")).toBeNull();
    expect(pipelineMove("active", "trial")).toBeNull();
    expect(pipelineMove("lead", "suspended")).toBeNull();
    expect(pipelineMove("cancelled", "suspended")).toBeNull();
    expect(pipelineMove("active", "active")).toBeNull();
  });
});
