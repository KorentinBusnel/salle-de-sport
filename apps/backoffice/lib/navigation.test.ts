import { describe, expect, it } from "vitest";
import { buildNavigation } from "./navigation";

const none = { ownCoachId: null };
const badge = (nav: ReturnType<typeof buildNavigation>, href: string) =>
  nav.groups.flatMap((g) => g.items).find((i) => i.href === href)?.badge;
const hrefs = (nav: ReturnType<typeof buildNavigation>) =>
  Object.fromEntries(nav.groups.map((g) => [g.label, g.items.map((i) => i.href)]));

describe("buildNavigation", () => {
  it("gérant : quotidien et opérations, Paramètres en pied", () => {
    const nav = buildNavigation("manager", none);
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
    // Pastilles par défaut : prospects et messages sans réponse.
    expect(badge(nav, "/adherents")).toBe("prospects");
    expect(badge(nav, "/messages")).toBe("unanswered");
    expect(badge(nav, "/crm")).toBeUndefined();
  });

  it("admin : comme le gérant, même s'il est aussi coach", () => {
    const nav = buildNavigation("admin", { ownCoachId: "c" });
    expect(hrefs(nav)["Quotidien"]).toEqual(["/", "/hub", "/planning", "/indicateurs"]);
  });

  it("pastilles choisies : chacune sur l'entrée qui la porte", () => {
    const nav = buildNavigation("manager", { ...none, badges: ["trials_to_call", "unpaid"] });
    expect(badge(nav, "/crm")).toBe("trials_to_call");
    expect(badge(nav, "/")).toBe("unpaid");
    expect(badge(nav, "/adherents")).toBeUndefined();
    expect(badge(nav, "/messages")).toBeUndefined();
  });

  it("accueil : planning et adhérents (pastille des prospects), pas de paramètres", () => {
    const nav = buildNavigation("staff", none);
    expect(hrefs(nav)).toEqual({ Quotidien: ["/", "/planning"], Opérations: ["/adherents"] });
    expect(badge(nav, "/adherents")).toBe("prospects");
    expect(nav.footer).toEqual([]);
  });

  it("coach : sa fiche et ses heures au quotidien, rien d'autre", () => {
    const nav = buildNavigation("coach", { ownCoachId: "c1" });
    expect(hrefs(nav)).toEqual({
      Quotidien: ["/", "/planning", "/coachs/c1", "/coachs/heures"],
    });
    expect(nav.footer).toEqual([]);
  });
});
