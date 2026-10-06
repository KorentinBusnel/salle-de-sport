import { describe, expect, it } from "vitest";
import { brand, faq, form, preview, seo } from "./landing";
import { legalPlaceholders } from "./legal";

describe("contenu de la landing", () => {
  it("title ≤ 60 caractères et description ≤ 155 (LANDING_BRIEF §4)", () => {
    expect(seo.title.length).toBeLessThanOrEqual(60);
    expect(seo.description.length).toBeLessThanOrEqual(155);
    expect(seo.title.startsWith(brand.name)).toBe(true);
  });

  it("FAQ : quatre questions, aucune sur les intégrations (BRIEF §12)", () => {
    expect(faq.items).toHaveLength(4);
    for (const item of faq.items) {
      expect(`${item.question} ${item.answer}`.toLowerCase()).not.toMatch(/intégr|stripe|gmail/);
    }
  });

  it("une étape par vue, la dernière sans numéro (Intégrations)", () => {
    expect(preview.steps.map((step) => step.id)).toEqual([
      "quotidien",
      "dashboard",
      "operations",
      "crm",
      "marketplace",
      "integrations",
    ]);
    expect(preview.steps.at(-1)?.num).toBeNull();
    expect(preview.integrations.tools).toHaveLength(6);
  });

  it("chaque erreur du formulaire a un message", () => {
    for (const key of ["email", "consent", "rate_limited", "generic"] as const) {
      expect(form.errors[key].length).toBeGreaterThan(0);
    }
  });

  it("liste les informations légales encore à compléter", () => {
    expect(legalPlaceholders()).toContain("Mentions légales › Éditeur du site");
  });
});
