import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "./demo.ts";

const valid = {
  fullName: "  Inès Moreau ",
  gymName: "Box Garonne",
  email: " Ines@Box-Garonne.fr ",
  phone: "",
  city: "Toulouse",
  membersBand: "100_to_300",
  currentTool: "Bsport",
  message: "",
};

describe("demoRequestSchema", () => {
  it("normalise les champs et rend null les champs facultatifs vides", () => {
    expect(demoRequestSchema.parse(valid)).toEqual({
      fullName: "Inès Moreau",
      gymName: "Box Garonne",
      email: "ines@box-garonne.fr",
      phone: null,
      city: "Toulouse",
      membersBand: "100_to_300",
      currentTool: "Bsport",
      message: null,
    });
  });

  it("refuse un email, un téléphone ou une taille invalides", () => {
    const issues = (input: Partial<typeof valid>) =>
      demoRequestSchema
        .safeParse({ ...valid, ...input })
        .error?.issues.map((issue) => issue.path[0]);
    expect(issues({ email: "ines@" })).toEqual(["email"]);
    expect(issues({ phone: "appelez moi" })).toEqual(["phone"]);
    expect(issues({ membersBand: "1000" })).toEqual(["membersBand"]);
    expect(issues({ fullName: " I " })).toEqual(["fullName"]);
  });

  it("accepte un téléphone français ou international", () => {
    for (const phone of ["06 12 34 56 78", "+33 6 12 34 56 78", "06.12.34.56.78"]) {
      expect(demoRequestSchema.safeParse({ ...valid, phone }).success).toBe(true);
    }
  });
});
