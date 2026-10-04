import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("t", () => {
  it("renvoie le texte d'une clé", () => {
    expect(t("login.submit")).toBe("Se connecter");
  });

  it("remplace les paramètres", () => {
    expect(t("dashboard.places", { booked: 12, capacity: 16 })).toBe("12 / 16");
  });

  it("laisse intact un paramètre manquant", () => {
    expect(t("dashboard.waitlist")).toBe("+{count} en attente");
  });
});
