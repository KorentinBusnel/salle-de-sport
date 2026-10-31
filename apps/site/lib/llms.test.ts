import { describe, expect, it } from "vitest";
import { llmsText } from "./llms";
import { LEGAL_COMPLETE } from "./site";

describe("llmsText", () => {
  const text = llmsText("https://chalq.example");

  it("suit le format llmstxt.org : titre, résumé en citation, sections", () => {
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^# Chalq · Logiciel de gestion de salle de sport/);
    expect(lines[2]).toMatch(/^> Chalq est un logiciel de gestion de salle de sport/);
    expect(text).toContain("## Fonctionnalités");
    expect(text).toContain("## Pages");
    expect(text).toContain("## Contact");
  });

  it("donne des liens absolus vers le site", () => {
    expect(text).toContain("- [Accueil](https://chalq.example/): ");
    expect(text).toContain("(https://chalq.example/#fonctionnalites)");
  });

  it("ne liste les pages légales qu'une fois les mentions complètes", () => {
    expect(text.includes("/mentions-legales")).toBe(LEGAL_COMPLETE);
    expect(text.includes("/confidentialite")).toBe(LEGAL_COMPLETE);
  });
});
