import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "./demo.ts";

const trial = {
  kind: "trial",
  fullName: "  Inès Moreau ",
  gymName: "Box Garonne",
  email: " Ines@Box-Garonne.fr ",
  phone: "",
  city: "Toulouse",
  membersBand: "100_to_300",
  currentTool: "Bsport",
  message: "",
};

const contact = {
  ...trial,
  kind: "contact",
  city: "",
  membersBand: "",
  message: "Le prélèvement SEPA est inclus ?",
};

const issues = (input: Record<string, string>) =>
  demoRequestSchema.safeParse(input).error?.issues.map((issue) => issue.path[0]);

describe("demoRequestSchema", () => {
  it("essai : normalise les champs et rend null les champs facultatifs vides", () => {
    expect(demoRequestSchema.parse(trial)).toEqual({
      kind: "trial",
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

  it("question : ville et taille facultatives, message exigé", () => {
    expect(demoRequestSchema.parse(contact)).toMatchObject({
      kind: "contact",
      city: null,
      membersBand: null,
      message: "Le prélèvement SEPA est inclus ?",
    });
    expect(issues({ ...contact, message: " " })).toEqual(["message"]);
    expect(issues({ ...contact, city: "T" })).toEqual(["city"]);
  });

  it("essai : refuse une ville, une taille, un email ou un téléphone invalides", () => {
    expect(issues({ ...trial, city: "" })).toEqual(["city"]);
    expect(issues({ ...trial, membersBand: "" })).toEqual(["membersBand"]);
    expect(issues({ ...trial, email: "ines@" })).toEqual(["email"]);
    expect(issues({ ...trial, phone: "appelez moi" })).toEqual(["phone"]);
    expect(issues({ ...trial, fullName: " I " })).toEqual(["fullName"]);
    expect(issues({ ...trial, kind: "demo" })).toEqual(["kind"]);
  });

  it("accepte un téléphone français ou international", () => {
    for (const phone of ["06 12 34 56 78", "+33 6 12 34 56 78", "06.12.34.56.78"]) {
      expect(demoRequestSchema.safeParse({ ...trial, phone }).success).toBe(true);
    }
  });
});
