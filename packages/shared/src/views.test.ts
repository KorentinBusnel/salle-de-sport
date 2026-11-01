import { describe, expect, it } from "vitest";
import {
  builtinPlanningView,
  hasPlanningFilters,
  isBuiltinPlanningView,
  isPlanningViewDirty,
  parsePlanningFilters,
  parsePlanningView,
  planningStateFromSearch,
  planningStatePairs,
  builtinKanbanView,
  builtinMemberView,
  groupKanban,
  isBuiltinKanbanView,
  KANBAN_NONE,
  kanbanColumnFilters,
  kanbanGroupField,
  viewGroupBy,
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
      groupBy: null,
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
      groupBy: null,
    });
    expect(viewStateFromSearch({ cols: "none" }, view).columns).toEqual([]);
    expect(isViewDirty(view, state)).toBe(true);
    expect(isViewDirty(view, viewStateFromSearch({ q: "x" }, view))).toBe(false);
  });
  it("l'URL ne porte que les écarts, dont « aucun filtre »", () => {
    expect(viewStatePairs(view, viewStateFromSearch({}, view))).toEqual([["vue", "actifs"]]);
    expect(
      viewStatePairs(view, { filters: {}, sort: "name", columns: [], query: "a", groupBy: null }),
    ).toEqual([
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
        groupBy: null,
      }),
    ).toEqual([
      ["vue", "actifs"],
      ["statuses", "active"],
      ["tags", "hyrox"],
      ["tri", "recent"],
    ]);
  });
});

describe("kanban", () => {
  const field = {
    key: "suivi",
    type: "select" as const,
    options: [
      { value: "nouveau", label: "Nouveau", tone: "neutral" as const },
      { value: "contacte", label: "Contacté", tone: "brand" as const },
    ],
  };
  const rows = [
    { id: "a", stage: "lead", fields: { suivi: "contacte" } },
    { id: "b", stage: "trial", fields: {} },
    { id: "c", stage: "active", fields: { suivi: "ancienne_option" } },
    { id: "d", stage: "lead", fields: { suivi: "nouveau" } },
    { id: "e", stage: "lead", fields: null },
  ];

  it("vue intégrée « etapes » : kanban groupé par étape", () => {
    const view = builtinKanbanView("etapes", "Étapes");
    expect(isBuiltinKanbanView("etapes")).toBe(true);
    expect(view.layout).toBe("kanban");
    expect(viewGroupBy(view)).toBe("stage");
    expect(viewGroupBy(builtinMemberView("tous", "Tous"))).toBeNull();
  });

  it("groupement porté par ?groupe=, écart signalé et réécrit dans l'URL", () => {
    const view = builtinKanbanView("etapes", "Étapes");
    expect(viewStateFromSearch({}, view).groupBy).toBe("stage");
    const state = viewStateFromSearch({ groupe: "f:suivi" }, view);
    expect(state.groupBy).toBe("f:suivi");
    expect(isViewDirty(view, state)).toBe(true);
    expect(viewStatePairs(view, state)).toEqual([
      ["vue", "etapes"],
      ["groupe", "f:suivi"],
    ]);
    expect(viewStateFromSearch({ groupe: "n'importe quoi" }, view).groupBy).toBe("stage");
    // Un tableau ignore le groupement.
    expect(
      viewStateFromSearch({ groupe: "f:suivi" }, builtinMemberView("tous", "Tous")).groupBy,
    ).toBeNull();
  });

  it("champ de groupement : liste simple seulement", () => {
    const fields = [
      { key: "suivi", type: "select" as const },
      { key: "niveaux", type: "multi_select" as const },
    ];
    expect(kanbanGroupField("f:suivi", fields)?.key).toBe("suivi");
    expect(kanbanGroupField("f:niveaux", fields)).toBeNull();
    expect(kanbanGroupField("stage", fields)).toBeNull();
    expect(kanbanGroupField(null, fields)).toBeNull();
  });

  it("colonnes par étape", () => {
    const groups = groupKanban(rows, null);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id).join("")])).toEqual([
      ["lead", "ade"],
      ["trial", "b"],
      ["active", "c"],
      ["suspended", ""],
      ["cancelled", ""],
    ]);
    expect(groups[0]?.tone).toBe("brand");
  });

  it("colonnes par option, puis « Sans valeur » (absente ou option disparue)", () => {
    const groups = groupKanban(rows, field);
    expect(groups.map((g) => [g.key, g.label, g.rows.map((r) => r.id).join("")])).toEqual([
      ["nouveau", "Nouveau", "d"],
      ["contacte", "Contacté", "a"],
      [KANBAN_NONE, null, "bce"],
    ]);
  });

  it("filtres de la liste complète d'une colonne", () => {
    expect(kanbanColumnFilters({ tags: ["x"] }, "trial", null)).toEqual({
      tags: ["essai"],
      statuses: ["prospect"],
    });
    expect(kanbanColumnFilters({}, "active", null)).toEqual({ statuses: ["active"] });
    expect(
      kanbanColumnFilters(
        { fields: [{ key: "suivi", op: "is", value: "nouveau" }] },
        "contacte",
        field,
      ),
    ).toEqual({ fields: [{ key: "suivi", op: "is", value: "contacte" }] });
    expect(kanbanColumnFilters({}, KANBAN_NONE, field)).toEqual({
      fields: [{ key: "suivi", op: "is_empty" }],
    });
  });
});

describe("vues du planning", () => {
  const d1 = "0c2b4c9e-6f1a-4a3b-9e2d-000000000001";
  const d2 = "0c2b4c9e-6f1a-4a3b-9e2d-000000000002";
  const c1 = "0c2b4c9e-6f1a-4a3b-9e2d-000000000003";

  it("vues intégrées : les deux affichages d'origine", () => {
    expect(isBuiltinPlanningView("semaine")).toBe(true);
    expect(isBuiltinPlanningView("mois")).toBe(false);
    expect(builtinPlanningView("jour", "Jour").layout).toBe("day");
    expect(builtinPlanningView("semaine", "Semaine")).toMatchObject({
      layout: "week",
      filters: {},
      color: "discipline",
    });
  });

  it("filtres tolérants : identifiants invalides et clés inconnues ignorés", () => {
    expect(
      parsePlanningFilters({ disciplines: [d1, "x", d1], rooms: "nope", mine: true, autre: 1 }),
    ).toEqual({ disciplines: [d1], mine: true });
    expect(parsePlanningFilters(null)).toEqual({});
  });

  it("vue enregistrée : couleur rangée dans group_by, affichage jour ou semaine", () => {
    const view = parsePlanningView({
      id: c1,
      name: "Coachs du matin",
      layout: "day",
      filters: { coaches: [c1] },
      group_by: "coach",
      visibility: "private",
      created_by: c1,
      position: 0,
    });
    expect(view).toMatchObject({ layout: "day", color: "coach", filters: { coaches: [c1] } });
    expect(
      parsePlanningView({ ...view, created_by: null, group_by: "x", layout: "z" }),
    ).toMatchObject({ layout: "week", color: "discipline" });
  });

  it("état : ?d= d'avant compris, couleur, écarts réécrits, « aucun filtre »", () => {
    const view = builtinPlanningView("semaine", "Semaine");
    expect(planningStateFromSearch({}, view)).toEqual({ filters: {}, color: "discipline" });
    const state = planningStateFromSearch(
      { d: `${d1},${d2},pas-un-id`, mes: "1", couleur: "coach" },
      view,
    );
    expect(state).toEqual({ filters: { disciplines: [d1, d2], mine: true }, color: "coach" });
    expect(isPlanningViewDirty(view, state)).toBe(true);
    expect(planningStatePairs(view, state)).toEqual([
      ["d", `${d1},${d2}`],
      ["mes", "1"],
      ["couleur", "coach"],
    ]);
    const saved = { ...view, id: c1, builtin: false, filters: { rooms: [d1] } };
    const cleared = planningStateFromSearch({ f0: "1" }, saved);
    expect(cleared.filters).toEqual({});
    expect(planningStatePairs(saved, cleared)).toEqual([["f0", "1"]]);
    expect(isPlanningViewDirty(saved, planningStateFromSearch({}, saved))).toBe(false);
    expect(hasPlanningFilters({})).toBe(false);
    expect(hasPlanningFilters({ mine: true })).toBe(true);
  });
});
