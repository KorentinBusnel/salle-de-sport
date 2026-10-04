import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n.ts";

const t = createTranslator({
  login: { submit: "Se connecter" },
  planning: { places: "{booked} / {capacity}" },
} as const);

describe("createTranslator", () => {
  it("renvoie le texte d'une clé", () => {
    expect(t("login.submit")).toBe("Se connecter");
  });

  it("remplace les paramètres", () => {
    expect(t("planning.places", { booked: 12, capacity: 16 })).toBe("12 / 16");
  });

  it("laisse intact un paramètre manquant", () => {
    expect(t("planning.places", { booked: 3 })).toBe("3 / {capacity}");
  });
});
