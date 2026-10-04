import { describe, expect, it } from "vitest";
import { classChangesSchema, coachesLabel, templateChangesSchema } from "./classes.ts";

describe("classChangesSchema", () => {
  it("valide durée (pas de 5), places et coachs", () => {
    expect(classChangesSchema.safeParse({ duration_minutes: 75, capacity: 12 }).success).toBe(true);
    expect(classChangesSchema.safeParse({ duration_minutes: 47 }).success).toBe(false);
    expect(classChangesSchema.safeParse({ capacity: 0 }).success).toBe(false);
    expect(classChangesSchema.safeParse({ room_id: null }).success).toBe(true);
    expect(classChangesSchema.safeParse({ weekday: 2 }).success).toBe(false);
  });

  it("le cours récurrent accepte aussi jour, heure et période", () => {
    expect(templateChangesSchema.safeParse({ weekday: 2, start_time: "18:30" }).success).toBe(true);
    expect(templateChangesSchema.safeParse({ start_time: "25:00" }).success).toBe(false);
  });
});

describe("coachesLabel", () => {
  it("résume plusieurs coachs", () => {
    expect(coachesLabel([])).toBe("");
    expect(coachesLabel(["Sarah B."])).toBe("Sarah B.");
    expect(coachesLabel(["Sarah B.", "Julien M.", "Inès G."])).toBe("Sarah B. + 2");
  });
});
