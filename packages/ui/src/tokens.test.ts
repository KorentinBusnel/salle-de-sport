import { describe, expect, it } from "vitest";
import { colors, disciplineColors } from "./tokens.ts";

function collectColors(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(collectColors);
  return [];
}

describe("tokens de couleur", () => {
  it("sont tous des codes hexadécimaux à 6 chiffres", () => {
    for (const color of collectColors({ colors, disciplineColors })) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
