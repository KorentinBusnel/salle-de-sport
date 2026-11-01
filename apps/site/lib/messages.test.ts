import { describe, expect, it } from "vitest";
import { frenchSpacing, t } from "@/lib/i18n";
import { fr } from "@/messages/fr";

function entries(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (node && typeof node === "object")
    return Object.entries(node).flatMap(([key, value]) =>
      entries(value, path ? `${path}.${key}` : key),
    );
  return [];
}

// Mots creux interdits par le skill landing-page-design (B8), en français.
const BANNED = [
  /révolution/i,
  /booster/i,
  /sans effort/i,
  /de pointe/i,
  /transforme[rz]? votre/i,
  /niveau supérieur/i,
  /la puissance/i,
  /classe mondiale/i,
  /optimis/i,
  /fluidifi/i,
];

describe("catalogue du site", () => {
  it("aucun trait d'union dans les textes (skill B1)", () => {
    const withHyphen = entries(fr).filter(([, message]) => message.includes("-"));
    expect(withHyphen.map(([key]) => key)).toEqual([]);
  });

  it("aucun mot creux (skill B8)", () => {
    const hollow = entries(fr).filter(([, message]) => BANNED.some((word) => word.test(message)));
    expect(hollow.map(([key]) => key)).toEqual([]);
  });

  it("aucun point d'exclamation (messages calmes, skill B8)", () => {
    const loud = entries(fr).filter(([, message]) => message.includes("!"));
    expect(loud.map(([key]) => key)).toEqual([]);
  });
});

describe("t()", () => {
  it("remplit le nom du produit et pose les espaces insécables", () => {
    expect(t("hero.backofficeAlt")).toMatch(/^Page Aujourd'hui du back office Chalq\u00a0: /);
    expect(frenchSpacing("« Tous présents » : oui")).toBe("«\u00a0Tous présents\u00a0»\u00a0: oui");
  });
});
