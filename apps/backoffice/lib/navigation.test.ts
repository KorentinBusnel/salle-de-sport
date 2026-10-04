import { describe, expect, it } from "vitest";
import { buildNavigation } from "./navigation";

const hrefs = (groups: ReturnType<typeof buildNavigation>) =>
  Object.fromEntries(groups.map((g) => [g.label, g.items.map((i) => i.href)]));

describe("buildNavigation", () => {
  it("gérant : quotidien, opérations et paramètres", () => {
    expect(hrefs(buildNavigation("manager", { prospects: 3, ownCoachId: null }))).toEqual({
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
      Paramètres: ["/parametres"],
    });
  });

  it("admin : comme le gérant, même s'il est aussi coach", () => {
    const groups = buildNavigation("admin", { prospects: 0, ownCoachId: "c" });
    expect(hrefs(groups)["Quotidien"]).toEqual(["/", "/hub", "/planning", "/indicateurs"]);
    expect(groups.find((g) => g.label === "Opérations")?.items[0]?.badge).toBeUndefined();
  });

  it("accueil : planning et adhérents (badge des prospects), pas de paramètres", () => {
    const groups = buildNavigation("staff", { prospects: 4, ownCoachId: null });
    expect(hrefs(groups)).toEqual({ Quotidien: ["/", "/planning"], Opérations: ["/adherents"] });
    expect(groups[1]?.items[0]?.badge).toBe(4);
  });

  it("coach : sa fiche et ses heures au quotidien, rien d'autre", () => {
    expect(hrefs(buildNavigation("coach", { prospects: 0, ownCoachId: "c1" }))).toEqual({
      Quotidien: ["/", "/planning", "/coachs/c1", "/coachs/heures"],
    });
  });
});
