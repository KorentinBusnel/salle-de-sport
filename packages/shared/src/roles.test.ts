import { describe, expect, it } from "vitest";
import { canSeeFinancials, GYM_ROLES, gymRoleSchema, isStaffRole } from "./roles.ts";

describe("gymRoleSchema", () => {
  it("accepte chaque rôle connu", () => {
    for (const role of GYM_ROLES) {
      expect(gymRoleSchema.parse(role)).toBe(role);
    }
  });

  it("refuse un rôle inconnu", () => {
    expect(gymRoleSchema.safeParse("owner").success).toBe(false);
  });
});

describe("canSeeFinancials", () => {
  it("réserve les finances aux gérants et admins", () => {
    expect(GYM_ROLES.filter(canSeeFinancials)).toEqual(["manager", "admin"]);
  });
});

describe("isStaffRole", () => {
  it("exclut uniquement les adhérents", () => {
    expect(GYM_ROLES.filter((role) => !isStaffRole(role))).toEqual(["member"]);
  });
});
