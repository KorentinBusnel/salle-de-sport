import { readFileSync } from "node:fs";
import { contrast, tint } from "@salle/ui";
import { describe, expect, it } from "vitest";
import { colors } from "./tokens";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("globals.css", () => {
  it("reflète exactement les couleurs de lib/tokens.ts", () => {
    const declared = new Map<string, string>();
    for (const match of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/g)) {
      declared.set(match[1] ?? "", match[2] ?? "");
    }
    declared.delete("white");
    expect(Object.fromEntries(declared)).toEqual({ ...colors });
  });
});

describe("contrastes WCAG AA", () => {
  const light = [colors.background, colors.card];

  it.each([
    ["texte principal", colors.foreground],
    ["texte secondaire", colors["muted-foreground"]],
  ])("%s sur le fond et les cartes ≥ 4,5:1", (_, text) => {
    for (const surface of light) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("texte des boutons d'action ≥ 4,5:1 (repos et survol)", () => {
    expect(contrast(colors["primary-foreground"], colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors["primary-foreground"], colors["primary-hover"])).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("pastille indigo (texte survol sur teinte d'action à 10 %) ≥ 4,5:1", () => {
    expect(
      contrast(colors["primary-hover"], tint(colors.primary, colors.card)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("cartes sombres : texte blanc et tertiaire ≥ 4,5:1", () => {
    expect(contrast(colors.card, colors.foreground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.faint, colors.foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it("le tertiaire reste illisible sur fond clair (d'où son usage sur fond sombre seulement)", () => {
    expect(contrast(colors.faint, colors.card)).toBeLessThan(4.5);
  });

  it("anneau de focus ≥ 3:1", () => {
    for (const surface of light)
      expect(contrast(colors.primary, surface)).toBeGreaterThanOrEqual(3);
  });
});
