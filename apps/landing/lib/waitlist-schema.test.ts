import { describe, expect, it } from "vitest";
import { firstError, parseWaitlistForm } from "./waitlist-schema";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("formulaire de la liste d'attente", () => {
  it("normalise l'email et garde les UTM", () => {
    const parsed = parseWaitlistForm(
      formData({
        email: "  Gerant@Ma-Salle.FR ",
        consent: "on",
        placement: "hero",
        website: "",
        utm_source: "linkedin",
        utm_medium: "",
        utm_campaign: "x".repeat(150),
      }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      email: "gerant@ma-salle.fr",
      placement: "hero",
      utm_source: "linkedin",
      utm_medium: undefined,
      utm_campaign: "x".repeat(100),
    });
  });

  it("refuse une adresse invalide (erreur email d'abord)", () => {
    const parsed = parseWaitlistForm(formData({ email: "pas-un-email", placement: "final" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("email");
  });

  it("exige la case de consentement", () => {
    const parsed = parseWaitlistForm(formData({ email: "a@b.fr", placement: "final" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("consent");
  });

  it("refuse un emplacement inconnu", () => {
    const parsed = parseWaitlistForm(formData({ email: "a@b.fr", consent: "on", placement: "x" }));
    expect(parsed.success).toBe(false);
  });

  it("laisse passer le honeypot rempli (traité par l'action : faux succès)", () => {
    const parsed = parseWaitlistForm(
      formData({ email: "a@b.fr", consent: "on", placement: "hero", website: "spam" }),
    );
    expect(parsed.success && parsed.data.website).toBe("spam");
  });
});
