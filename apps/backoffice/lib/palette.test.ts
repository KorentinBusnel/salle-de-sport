import { describe, expect, it } from "vitest";
import { filterEntries, parseRecents, pushRecent, RECENTS_MAX } from "./palette";

const entries = [
  { label: "Planning", hint: "Semaine" },
  { label: "Paramètres", hint: "Réglages de la salle" },
  { label: "Cours récurrents", hint: "Modèles du planning" },
];

describe("filterEntries", () => {
  it("rend tout sans frappe", () => {
    expect(filterEntries(entries, "  ")).toHaveLength(3);
  });

  it("ignore accents et casse, cherche aussi l'aide", () => {
    expect(filterEntries(entries, "REGLAGES").map((e) => e.label)).toEqual(["Paramètres"]);
    expect(filterEntries(entries, "recurrent").map((e) => e.label)).toEqual(["Cours récurrents"]);
  });

  it("met devant les libellés qui commencent par la frappe", () => {
    expect(filterEntries(entries, "plan").map((e) => e.label)).toEqual([
      "Planning",
      "Cours récurrents",
    ]);
  });

  it("exige chaque mot", () => {
    expect(filterEntries(entries, "cours salle")).toEqual([]);
  });
});

describe("récents", () => {
  it("met en tête sans doublon et borne la liste", () => {
    let list = parseRecents(null);
    for (let i = 0; i < 8; i++)
      list = pushRecent(list, { href: `/p${i}`, label: `P${i}`, kind: "page" });
    list = pushRecent(list, { href: "/p5", label: "P5", kind: "page" });
    expect(list).toHaveLength(RECENTS_MAX);
    expect(list.map((e) => e.href)).toEqual(["/p5", "/p7", "/p6", "/p4", "/p3"]);
  });

  it("rejette un stockage abîmé ou des liens externes", () => {
    expect(parseRecents("{oops")).toEqual([]);
    expect(parseRecents('[{"href":"https://x","label":"X","kind":"page"}]')).toEqual([]);
    expect(parseRecents('[{"href":"//x","label":"X","kind":"page"}]')).toEqual([]);
    expect(parseRecents('[{"href":"/a","label":"A","kind":"member"}]')).toHaveLength(1);
  });
});
