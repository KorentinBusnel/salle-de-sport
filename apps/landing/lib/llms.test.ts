import { describe, expect, it } from "vitest";
import { brand, faq } from "@/content/landing";
import { buildLlmsTxt } from "./llms";

const text = buildLlmsTxt(new URL("https://kettl.ai"));

describe("/llms.txt", () => {
  it("titre, résumé et sections attendues", () => {
    expect(text.startsWith(`# ${brand.name}\n\n> `)).toBe(true);
    for (const section of ["## Produit", "## Pour qui", "## Tarif", "## Lancement", "## Liens"]) {
      expect(text).toContain(section);
    }
    expect(text).toContain("99 €");
    expect(text).toContain("début 2027");
    expect(text).toContain("https://kettl.ai/#faq");
  });

  it("reprend la FAQ et ne parle pas d'intégrations (BRIEF §12)", () => {
    for (const item of faq.items) expect(text).toContain(item.answer);
    expect(text.toLowerCase()).not.toMatch(/intégration|stripe|pennylane|gymlib|whatsapp/);
  });
});
