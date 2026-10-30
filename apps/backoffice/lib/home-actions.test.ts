import { describe, expect, it } from "vitest";
import { countActions } from "./home-actions";

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
