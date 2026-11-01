import { describe, expect, it } from "vitest";
import {
  builtinMemberView,
  BUILTIN_MEMBER_VIEWS,
  fieldColumn,
  fieldKeyOfColumn,
  filtersFromSearch,
  filtersToPairs,
  hasFilters,
  isBuiltinMemberView,
  isViewDirty,
  memberViewSchema,
  parseMemberView,
  sameFilters,
  viewStateFromSearch,
  viewStatePairs,
} from "./views.ts";

const row = {
  id: "0c2b4c9e-6f1a-4a3b-9e2d-000000000001",
  name: "Prospects à rappeler",
  layout: "table",
  filters: { statuses: ["prospect"], fields: [{ key: "objectif", op: "is", value: "x" }] },
  sort: "recent",
  columns: ["contact", "f:objectif", "f:disparu", "inconnue"],
  group_by: "f:disparu",
  visibility: "team",
  created_by: null,
  position: 2,
};

describe("vues intégrées", () => {
  it("les onglets de statut existent, « tous » sans filtre", () => {
    expect(BUILTIN_MEMBER_VIEWS.map((view) => view.id)).toEqual([
      "a-activer",
      "actifs",
      "suspendus",
      "resilies",
      "tous",
    ]);
    expect(isBuiltinMemberView("tous")).toBe(true);
    expect(isBuiltinMemberView("0c2b4c9e-6f1a-4a3b-9e2d-000000000001")).toBe(false);
    const view = builtinMemberView("a-activer", "À activer");
    expect(view.filters).toEqual({ statuses: ["prospect"] });
    expect(view.builtin).toBe(true);
    expect(view.columns).toEqual(["contact", "status", "credits"]);
  });
});

describe("parseMemberView", () => {
  it("ignore les colonnes et le groupement d'un champ disparu, un tri inconnu", () => {
    const view = parseMemberView({ ...row, sort: "nope" }, ["objectif"]);
    expect(view.columns).toEqual(["contact", "f:objectif"]);
    expect(view.group_by).toBeNull();
    expect(view.sort).toBe("name");
    expect(view.filters).toEqual(row.filters);
    expect(view.visibility).toBe("team");
    expect(parseMemberView({ ...row, group_by: "stage" }, []).group_by).toBe("stage");
    expect(parseMemberView({ ...row, columns: null }, []).columns).toEqual([
      "contact",
      "status",
      "credits",
    ]);
  });
  it("le schéma strict refuse une colonne inconnue, accepte f:<clé>", () => {
    expect(memberViewSchema.safeParse({ ...row, columns: ["inconnue"] }).success).toBe(false);
    expect(
      memberViewSchema.safeParse({
        layout: "table",
        filters: {},
        sort: "name",
        columns: [fieldColumn("objectif")],
        group_by: null,
      }).success,
    ).toBe(true);
    expect(fieldKeyOfColumn("f:objectif")).toBe("objectif");
    expect(fieldKeyOfColumn("f:Objectif")).toBeNull();
    expect(fieldKeyOfColumn("contact")).toBeNull();
  });
});

describe("filtres ⇄ URL", () => {
  it("null sans paramètre de filtre, alias statut / tag, listes à virgule ou clé répétée", () => {
    expect(filtersFromSearch({ q: "x", page: "2" })).toBeNull();
    expect(filtersFromSearch({ statut: "prospect", tag: "Essai" })).toEqual({
      statuses: ["prospect"],
      tags: ["essai"],
    });
    expect(filtersFromSearch({ statuses: "prospect,active" })).toEqual({
      statuses: ["prospect", "active"],
    });
    expect(filtersFromSearch({ statuses: ["prospect", "active"] })).toEqual({
      statuses: ["prospect", "active"],
    });
    expect(filtersFromSearch({ f0: "1" })).toEqual({});
  });
  it("aller-retour complet, conditions de champ en JSON", () => {
    const filters = {
      statuses: ["active" as const],
      tags: ["hyrox"],
      inactive_days: 14,
      max_credits: 2,
      joined_since: "2026-09-01",
      birthday_month: true as const,
      email_consent: true as const,
      fields: [{ key: "objectif", op: "is" as const, value: "competition" }],
    };
    const params = Object.fromEntries(filtersToPairs(filters));
    expect(params.f).toBe(JSON.stringify(filters.fields));
    expect(filtersFromSearch(params)).toEqual(filters);
    expect(filtersFromSearch({ f: "{pas du json" })).toEqual({});
  });
  it("hasFilters et sameFilters (ordre des listes indifférent)", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ statuses: [] })).toBe(false);
    expect(hasFilters({ birthday_month: true })).toBe(true);
    expect(
      sameFilters({ statuses: ["active", "prospect"] }, { statuses: ["prospect", "active"] }),
    ).toBe(true);
    expect(sameFilters({ statuses: ["active"] }, {})).toBe(false);
  });
});

describe("état d'une vue", () => {
  const view = builtinMemberView("actifs", "Actifs");
  it("sans paramètre : la vue ; avec : les écarts", () => {
    expect(viewStateFromSearch({}, view)).toEqual({
      filters: { statuses: ["active"] },
      sort: "name",
      columns: ["contact", "status", "credits"],
      query: "",
    });
    const state = viewStateFromSearch(
      { f0: "1", tri: "recent", cols: "status,f:objectif,bidon", q: " Camille " },
      view,
    );
    expect(state).toEqual({
      filters: {},
      sort: "recent",
      columns: ["status", "f:objectif"],
      query: "Camille",
    });
    expect(viewStateFromSearch({ cols: "none" }, view).columns).toEqual([]);
    expect(isViewDirty(view, state)).toBe(true);
    expect(isViewDirty(view, viewStateFromSearch({ q: "x" }, view))).toBe(false);
  });
  it("l'URL ne porte que les écarts, dont « aucun filtre »", () => {
    expect(viewStatePairs(view, viewStateFromSearch({}, view))).toEqual([["vue", "actifs"]]);
    expect(viewStatePairs(view, { filters: {}, sort: "name", columns: [], query: "a" })).toEqual([
      ["vue", "actifs"],
      ["f0", "1"],
      ["cols", "none"],
      ["q", "a"],
    ]);
    expect(
      viewStatePairs(view, {
        filters: { statuses: ["active"], tags: ["hyrox"] },
        sort: "recent",
        columns: ["contact", "status", "credits"],
        query: "",
      }),
    ).toEqual([
      ["vue", "actifs"],
      ["statuses", "active"],
      ["tags", "hyrox"],
      ["tri", "recent"],
    ]);
  });
});
