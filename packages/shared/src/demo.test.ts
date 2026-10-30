import { describe, expect, it } from "vitest";
import { demoEmailSchema } from "./demo.ts";

describe("demoEmailSchema", () => {
  it("normalise l'email", () => {
    expect(demoEmailSchema.parse({ email: " Ines@Box-Garonne.fr " })).toEqual({
      email: "ines@box-garonne.fr",
    });
  });

  it("refuse un email vide, incomplet ou trop long", () => {
    for (const email of ["", "  ", "ines@", "ines.box-garonne.fr", `${"a".repeat(115)}@box.fr`]) {
      expect(demoEmailSchema.safeParse({ email }).success).toBe(false);
    }
  });
});
