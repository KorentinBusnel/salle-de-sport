import { describe, expect, it } from "vitest";
import { buildNavigation } from "./navigation";

const none = { prospects: 0, unanswered: 0, ownCoachId: null };
const hrefs = (nav: ReturnType<typeof buildNavigation>) =>
  Object.fromEntries(nav.groups.map((g) => [g.label, g.items.map((i) => i.href)]));

describe("buildNavigation", () => {
  it("gérant : quotidien et opérations, Paramètres en pied", () => {
    const nav = buildNavigation("manager", { ...none, prospects: 3, unanswered: 2 });
    expect(hrefs(nav)).toEqual({
      Quotidien: ["/", "/hub", "/planning", "/indicateurs"],
      Opérations: [
        "/adherents",
        "/crm",
        "/segments",
        "/emailing",
        "/messages",
        "/coachs",
        "/planning/modeles",
      ],
    });
    expect(nav.footer.map((i) => i.href)).toEqual(["/parametres"]);
    const operations = nav.groups[1]?.items ?? [];
    expect(operations.find((i) => i.href === "/adherents")?.badge).toBe(3);
    expect(operations.find((i) => i.href === "/messages")?.badge).toBe(2);
  });

  it("admin : comme le gérant, même s'il est aussi coach ; pas de pastille à zéro", () => {
    const nav = buildNavigation("admin", { ...none, ownCoachId: "c" });
    expect(hrefs(nav)["Quotidien"]).toEqual(["/", "/hub", "/planning", "/indicateurs"]);
    expect(nav.groups[1]?.items[0]?.badge).toBeUndefined();
  });

  it("accueil : planning et adhérents (pastille des prospects), pas de paramètres", () => {
    const nav = buildNavigation("staff", { ...none, prospects: 4, unanswered: 9 });
    expect(hrefs(nav)).toEqual({ Quotidien: ["/", "/planning"], Opérations: ["/adherents"] });
    expect(nav.groups[1]?.items[0]?.badge).toBe(4);
    expect(nav.footer).toEqual([]);
  });

  it("coach : sa fiche et ses heures au quotidien, rien d'autre", () => {
    const nav = buildNavigation("coach", { ...none, ownCoachId: "c1" });
    expect(hrefs(nav)).toEqual({
      Quotidien: ["/", "/planning", "/coachs/c1", "/coachs/heures"],
    });
    expect(nav.footer).toEqual([]);
  });
});
