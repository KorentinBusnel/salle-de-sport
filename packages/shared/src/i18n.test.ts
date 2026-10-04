import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n.ts";

const t = createTranslator({
  login: { submit: "Se connecter" },
  planning: {
    places: "{booked} / {capacity}",
    generated:
      "{count, plural, =0 {Aucune séance créée} one {# séance créée} other {# séances créées}}.",
    waitlist: "{count, plural, one {# personne} other {# personnes}} en attente pour {name}",
  },
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

  it("accorde le pluriel (français : 0 et 1 au singulier, =N prioritaire)", () => {
    expect(t("planning.generated", { count: 0 })).toBe("Aucune séance créée.");
    expect(t("planning.generated", { count: 1 })).toBe("1 séance créée.");
    expect(t("planning.generated", { count: 12 })).toBe("12 séances créées.");
    expect(t("planning.waitlist", { count: 3, name: "CrossFit" })).toBe(
      "3 personnes en attente pour CrossFit",
    );
  });
});
