import { describe, expect, it } from "vitest";
import { contrast, tint } from "./contrast.ts";
import { colors, disciplineColors, semantic } from "./tokens.ts";

function collectColors(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(collectColors);
  return [];
}

describe("tokens de couleur", () => {
  it("sont tous des codes hexadécimaux à 6 chiffres", () => {
    for (const color of collectColors({ colors, disciplineColors, semantic })) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("contrastes WCAG AA", () => {
  const surfaces = [semantic.background, semantic.card];

  it.each([
    ["foreground", semantic.foreground, semantic.background],
    ["primary-foreground sur primary", semantic["primary-foreground"], semantic.primary],
    ["accent-foreground sur accent", semantic["accent-foreground"], semantic.accent],
    ["muted-foreground sur muted", semantic["muted-foreground"], semantic.muted],
    ["secondary-foreground sur secondary", semantic["secondary-foreground"], semantic.secondary],
  ])("texte : %s ≥ 4,5:1", (_, text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["muted-foreground", semantic["muted-foreground"]],
    ["primary (liens)", semantic.primary],
    ["success", colors.success],
    ["warning", colors.warning],
    ["destructive", semantic.destructive],
  ])("texte %s sur le fond et les cartes ≥ 4,5:1", (_, text) => {
    for (const surface of surfaces) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["success", colors.success],
    ["warning", colors.warning],
    ["destructive", semantic.destructive],
  ])("pastille soft %s (texte sur sa teinte à 10 %%) ≥ 4,5:1", (_, color) => {
    for (const surface of surfaces) {
      expect(contrast(color, tint(color, surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["bordure des champs (input)", semantic.input],
    ["anneau de focus (ring)", semantic.ring],
  ])("composant : %s ≥ 3:1", (_, color) => {
    for (const surface of surfaces) expect(contrast(color, surface)).toBeGreaterThanOrEqual(3);
  });
});
