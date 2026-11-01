import { z } from "zod";
import {
  parseSegmentFilters,
  PIPELINE_STAGES,
  segmentFiltersSchema,
  type PipelineStage,
  type SegmentFilters,
} from "./crm.ts";
import { PIPELINE_STAGE_TONE, type Tone } from "./display.ts";
import {
  FIELD_KEY_PATTERN,
  MAX_FIELD_CONDITIONS,
  type FieldCondition,
  type MemberField,
} from "./fields.ts";

/**
 * Vues enregistrées (`saved_views`) : un tableau ou un kanban d'adhérents (ou une vue du
 * planning) avec ses filtres, son tri, ses colonnes et son groupement, partagé avec l'équipe ou
 * personnel. Les vues intégrées sont définies ici (jamais en base). L'état d'une page est porté
 * par l'URL ; une vue n'est qu'un état nommé, et l'URL ne porte que les écarts à la vue ouverte.
 */

export const VIEW_OBJECTS = ["members", "planning"] as const;
export type ViewObject = (typeof VIEW_OBJECTS)[number];
export const VIEW_VISIBILITIES = ["team", "private"] as const;
export type ViewVisibility = (typeof VIEW_VISIBILITIES)[number];
export const VIEW_NAME_MAX = 80;
export const VIEW_COLUMNS_MAX = 40;

// ---------------------------------------------------------------------------
// Vues d'adhérents
// ---------------------------------------------------------------------------

export const MEMBER_LAYOUTS = ["table", "kanban"] as const;
export type MemberLayout = (typeof MEMBER_LAYOUTS)[number];

/** Tris de `search_members` (`p_sort`). */
export const MEMBER_SORTS = [
  "name",
  "name_desc",
  "recent",
  "status",
  "credits",
  "credits_desc",
] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number];
export const DEFAULT_MEMBER_SORT: MemberSort = "name";

/** Colonnes de base du tableau (le nom est toujours affiché). */
export const MEMBER_BASE_COLUMNS = ["contact", "status", "credits"] as const;
export type MemberBaseColumn = (typeof MEMBER_BASE_COLUMNS)[number];
export const DEFAULT_MEMBER_COLUMNS: string[] = [...MEMBER_BASE_COLUMNS];

/** Colonne d'un champ personnalisé : `f:<clé>`. */
export const FIELD_COLUMN_PREFIX = "f:";
export function fieldColumn(key: string): string {
  return `${FIELD_COLUMN_PREFIX}${key}`;
}
export function fieldKeyOfColumn(column: string): string | null {
  if (!column.startsWith(FIELD_COLUMN_PREFIX)) return null;
  const key = column.slice(FIELD_COLUMN_PREFIX.length);
  return FIELD_KEY_PATTERN.test(key) ? key : null;
}
export function isMemberColumn(column: string): boolean {
  return (
    (MEMBER_BASE_COLUMNS as readonly string[]).includes(column) || fieldKeyOfColumn(column) !== null
  );
}

export const memberColumnSchema = z.string().max(48).refine(isMemberColumn);

/** Groupement d'un kanban : étapes déduites (`stage`) ou champ liste (`f:<clé>`). */
export function isMemberGroupBy(value: string): boolean {
  return value === "stage" || fieldKeyOfColumn(value) !== null;
}

export const memberViewSchema = z.object({
  layout: z.enum(MEMBER_LAYOUTS),
  filters: segmentFiltersSchema,
  sort: z.enum(MEMBER_SORTS),
  columns: z.array(memberColumnSchema).max(VIEW_COLUMNS_MAX),
  group_by: z.string().max(48).refine(isMemberGroupBy).nullable(),
});
export type MemberViewConfig = z.infer<typeof memberViewSchema>;

export type MemberView = MemberViewConfig & {
  /** Slug d'une vue intégrée, UUID d'une vue enregistrée. */
  id: string;
  name: string;
  builtin: boolean;
  visibility: ViewVisibility;
  createdBy: string | null;
  position: number;
};

/** Vues intégrées du tableau des adhérents : les onglets de statut, dans l'ordre. */
export const BUILTIN_MEMBER_VIEWS = [
  { id: "a-activer", filters: { statuses: ["prospect"] } },
  { id: "actifs", filters: { statuses: ["active"] } },
  { id: "suspendus", filters: { statuses: ["suspended"] } },
  { id: "resilies", filters: { statuses: ["cancelled"] } },
  { id: "tous", filters: {} },
] as const satisfies readonly { id: string; filters: SegmentFilters }[];
export type BuiltinMemberViewId = (typeof BUILTIN_MEMBER_VIEWS)[number]["id"];
export const DEFAULT_MEMBER_VIEW: BuiltinMemberViewId = "tous";

export function isBuiltinMemberView(id: string): id is BuiltinMemberViewId {
  return BUILTIN_MEMBER_VIEWS.some((view) => view.id === id);
}

/** Une vue intégrée, avec son libellé traduit par l'app. */
export function builtinMemberView(id: BuiltinMemberViewId, name: string): MemberView {
  const builtin = BUILTIN_MEMBER_VIEWS.find((view) => view.id === id) ?? BUILTIN_MEMBER_VIEWS[4];
  return {
    id,
    name,
    builtin: true,
    layout: "table",
    filters: { ...builtin.filters },
    sort: DEFAULT_MEMBER_SORT,
    columns: [...DEFAULT_MEMBER_COLUMNS],
    group_by: null,
    visibility: "team",
    createdBy: null,
    position: -1,
  };
}

/** Vues intégrées du kanban (`/crm`) : les étapes déduites du statut. */
export const BUILTIN_KANBAN_VIEWS = [{ id: "etapes", filters: {} }] as const satisfies readonly {
  id: string;
  filters: SegmentFilters;
}[];
export type BuiltinKanbanViewId = (typeof BUILTIN_KANBAN_VIEWS)[number]["id"];
export const DEFAULT_KANBAN_VIEW: BuiltinKanbanViewId = "etapes";
/** Groupement par défaut d'un kanban : les étapes déduites. */
export const STAGE_GROUP = "stage";

export function isBuiltinKanbanView(id: string): id is BuiltinKanbanViewId {
  return BUILTIN_KANBAN_VIEWS.some((view) => view.id === id);
}

export function builtinKanbanView(id: BuiltinKanbanViewId, name: string): MemberView {
  return {
    ...builtinMemberView("tous", name),
    id,
    layout: "kanban",
    filters: {},
    group_by: STAGE_GROUP,
  };
}

/**
 * Lit une ligne de `saved_views` (colonnes Json) en ignorant ce qui n'est plus valide : une
 * colonne ou un groupement d'un champ disparu, un tri inconnu. Une vue ne casse jamais l'écran.
 */
export function parseMemberView(
  row: {
    id: string;
    name: string;
    layout: string;
    filters: unknown;
    sort: string | null;
    columns: string[] | null;
    group_by: string | null;
    visibility: string;
    created_by: string | null;
    position: number;
  },
  knownFieldKeys: readonly string[],
): MemberView {
  const known = (column: string) => {
    const key = fieldKeyOfColumn(column);
    return key === null ? isMemberColumn(column) : knownFieldKeys.includes(key);
  };
  const columns = [...new Set((row.columns ?? []).filter(known))].slice(0, VIEW_COLUMNS_MAX);
  const groupBy =
    row.group_by !== null && isMemberGroupBy(row.group_by) && known(row.group_by)
      ? row.group_by
      : row.group_by === "stage"
        ? "stage"
        : null;
  return {
    id: row.id,
    name: row.name,
    builtin: false,
    layout: row.layout === "kanban" ? "kanban" : "table",
    filters: parseSegmentFilters(row.filters),
    sort: MEMBER_SORTS.find((sort) => sort === row.sort) ?? DEFAULT_MEMBER_SORT,
    columns: row.columns === null ? [...DEFAULT_MEMBER_COLUMNS] : columns,
    group_by: groupBy,
    visibility: row.visibility === "team" ? "team" : "private",
    createdBy: row.created_by,
    position: row.position,
  };
}

// ---------------------------------------------------------------------------
// Filtres ⇄ paramètres d'URL (paires, sans URLSearchParams : module partagé)
// ---------------------------------------------------------------------------

export type SearchParams = Record<string, string | string[] | undefined>;

/** Marqueur « aucun filtre » : distingue une vue dont on a retiré tous les filtres. */
export const NO_FILTERS_PARAM = "f0";
/** Paramètres d'URL qui décrivent des filtres (dont les anciens alias `statut` et `tag`). */
export const FILTER_PARAMS = [
  "statuses",
  "tags",
  "inactive_days",
  "discipline_id",
  "max_credits",
  "joined_since",
  "birthday_month",
  "email_consent",
  "f",
  NO_FILTERS_PARAM,
  "statut",
  "tag",
] as const;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Valeurs d'un paramètre : clé répétée ou liste séparée par des virgules. */
function listParam(params: SearchParams, key: string): string[] {
  const raw = params[key];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function intParam(params: SearchParams, key: string): number | undefined {
  const text = first(params[key]);
  return text && /^\d+$/.test(text) ? Number(text) : undefined;
}

function flagParam(params: SearchParams, key: string): true | undefined {
  const text = first(params[key]);
  return text === "on" || text === "1" || text === "true" ? true : undefined;
}

/** Les paramètres d'URL portent-ils des filtres (ou le marqueur « aucun filtre ») ? */
export function hasFilterParams(params: SearchParams): boolean {
  return FILTER_PARAMS.some((key) => params[key] !== undefined && params[key] !== "");
}

/** Filtres lus dans l'URL, ou `null` si l'URL n'en dit rien (la vue ouverte fait foi). */
export function filtersFromSearch(params: SearchParams): SegmentFilters | null {
  if (!hasFilterParams(params)) return null;
  let fields: unknown = undefined;
  const raw = first(params.f);
  if (raw) {
    try {
      fields = JSON.parse(raw);
    } catch {
      fields = undefined;
    }
  }
  const statuses = [...listParam(params, "statuses"), ...listParam(params, "statut")];
  const tags = [...listParam(params, "tags"), ...listParam(params, "tag")].map((tag) =>
    tag.toLowerCase(),
  );
  // Une liste vide n'est pas un filtre.
  return parseSegmentFilters({
    ...(statuses.length ? { statuses } : {}),
    ...(tags.length ? { tags } : {}),
    inactive_days: intParam(params, "inactive_days"),
    discipline_id: first(params.discipline_id)?.trim() || undefined,
    max_credits: intParam(params, "max_credits"),
    joined_since: first(params.joined_since)?.trim() || undefined,
    birthday_month: flagParam(params, "birthday_month"),
    email_consent: flagParam(params, "email_consent"),
    fields,
  });
}

/** Paires d'URL d'un jeu de filtres (une valeur par clé, listes séparées par des virgules). */
export function filtersToPairs(filters: SegmentFilters): [string, string][] {
  const pairs: [string, string][] = [];
  if (filters.statuses?.length) pairs.push(["statuses", filters.statuses.join(",")]);
  if (filters.tags?.length) pairs.push(["tags", filters.tags.join(",")]);
  if (filters.inactive_days !== undefined)
    pairs.push(["inactive_days", String(filters.inactive_days)]);
  if (filters.discipline_id) pairs.push(["discipline_id", filters.discipline_id]);
  if (filters.max_credits !== undefined) pairs.push(["max_credits", String(filters.max_credits)]);
  if (filters.joined_since) pairs.push(["joined_since", filters.joined_since]);
  if (filters.birthday_month) pairs.push(["birthday_month", "on"]);
  if (filters.email_consent) pairs.push(["email_consent", "on"]);
  if (filters.fields?.length) pairs.push(["f", JSON.stringify(filters.fields)]);
  return pairs;
}

/** Y a-t-il au moins un filtre ? */
export function hasFilters(filters: SegmentFilters): boolean {
  return Object.values(filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  );
}

/** Forme canonique (listes triées) pour comparer deux jeux de filtres. */
export function normalizeFilters(filters: SegmentFilters): SegmentFilters {
  const parsed = parseSegmentFilters(filters);
  return {
    ...parsed,
    ...(parsed.statuses ? { statuses: [...parsed.statuses].sort() } : {}),
    ...(parsed.tags ? { tags: [...parsed.tags].sort() } : {}),
  };
}

export function sameFilters(a: SegmentFilters, b: SegmentFilters): boolean {
  return JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));
}

// ---------------------------------------------------------------------------
// État d'une page d'adhérents : vue ouverte + écarts portés par l'URL
// ---------------------------------------------------------------------------

/** Paramètre `?cols=` sans aucune colonne (le nom reste affiché). */
export const NO_COLUMNS_PARAM = "none";

export type MemberViewState = {
  filters: SegmentFilters;
  sort: MemberSort;
  columns: string[];
  query: string;
  /** Kanban : groupement (`stage` ou `f:<clé>`, `?groupe=`) ; `null` pour un tableau. */
  groupBy: string | null;
};

/** Groupement d'une vue kanban (les étapes si la vue n'en a pas de valide). */
export function viewGroupBy(view: MemberView): string | null {
  if (view.layout !== "kanban") return null;
  return view.group_by !== null && isMemberGroupBy(view.group_by) ? view.group_by : STAGE_GROUP;
}

/** État de la page : la vue, corrigée par les paramètres d'URL présents. */
export function viewStateFromSearch(params: SearchParams, view: MemberView): MemberViewState {
  const fromUrl = filtersFromSearch(params);
  const sortParam = first(params.tri);
  const colsParam = first(params.cols);
  const columns =
    colsParam === undefined || colsParam === ""
      ? [...view.columns]
      : colsParam === NO_COLUMNS_PARAM
        ? []
        : [...new Set(colsParam.split(",").filter(isMemberColumn))];
  const groupParam = first(params.groupe);
  const groupBy =
    view.layout !== "kanban"
      ? null
      : groupParam && isMemberGroupBy(groupParam)
        ? groupParam
        : viewGroupBy(view);
  return {
    filters: fromUrl ?? { ...view.filters },
    sort: MEMBER_SORTS.find((sort) => sort === sortParam) ?? view.sort,
    columns,
    query: (first(params.q) ?? "").trim().slice(0, 80),
    groupBy,
  };
}

/**
 * L'état diffère-t-il de la vue (filtres, tri, colonnes, groupement d'un kanban ; la recherche
 * n'en fait pas partie) ?
 */
export function isViewDirty(view: MemberView, state: MemberViewState): boolean {
  return (
    !sameFilters(view.filters, state.filters) ||
    view.sort !== state.sort ||
    view.columns.join(",") !== state.columns.join(",") ||
    viewGroupBy(view) !== state.groupBy
  );
}

/**
 * Paires d'URL d'un état : `vue` puis les seuls écarts à la vue (filtres complets si différents,
 * marqueur « aucun filtre » si la vue en avait, tri, colonnes), puis la recherche.
 */
export function viewStatePairs(view: MemberView, state: MemberViewState): [string, string][] {
  const pairs: [string, string][] = [["vue", view.id]];
  if (!sameFilters(view.filters, state.filters)) {
    const filterPairs = filtersToPairs(state.filters);
    if (filterPairs.length) pairs.push(...filterPairs);
    else pairs.push([NO_FILTERS_PARAM, "1"]);
  }
  if (state.sort !== view.sort) pairs.push(["tri", state.sort]);
  if (state.columns.join(",") !== view.columns.join(","))
    pairs.push(["cols", state.columns.length ? state.columns.join(",") : NO_COLUMNS_PARAM]);
  if (state.groupBy !== null && state.groupBy !== viewGroupBy(view))
    pairs.push(["groupe", state.groupBy]);
  if (state.query) pairs.push(["q", state.query]);
  return pairs;
}

// ---------------------------------------------------------------------------
// Kanban : colonnes d'un groupement
// ---------------------------------------------------------------------------

/** Colonne « Sans valeur » d'un kanban groupé par un champ liste. */
export const KANBAN_NONE = "__none";

/** Seul un champ liste simple groupe un kanban (une carte, une colonne). */
export function isKanbanGroupField(field: Pick<MemberField, "type">): boolean {
  return field.type === "select";
}

/** Champ liste désigné par un groupement `f:<clé>` (null pour les étapes ou un champ inconnu). */
export function kanbanGroupField<F extends Pick<MemberField, "key" | "type">>(
  groupBy: string | null,
  fields: readonly F[],
): F | null {
  const key = groupBy === null ? null : fieldKeyOfColumn(groupBy);
  return fields.find((field) => field.key === key && isKanbanGroupField(field)) ?? null;
}

export type KanbanGroup<R> = {
  /** Étape, valeur d'option, ou `KANBAN_NONE`. */
  key: string;
  /** Libellé d'une option ; `null` : à traduire par l'app (étape, « Sans valeur »). */
  label: string | null;
  tone: Tone;
  rows: R[];
};

/**
 * Répartit les lignes de `crm_pipeline` en colonnes : par étape déduite, ou par option d'un
 * champ liste (dans l'ordre des options) suivie de « Sans valeur » (valeur absente ou option
 * disparue). L'ordre des lignes est conservé.
 */
export function groupKanban<R extends { stage: string; fields: unknown }>(
  rows: readonly R[],
  field: Pick<MemberField, "key" | "type" | "options"> | null,
): KanbanGroup<R>[] {
  if (!field || !isKanbanGroupField(field)) {
    return PIPELINE_STAGES.map((stage) => ({
      key: stage,
      label: null,
      tone: PIPELINE_STAGE_TONE[stage],
      rows: rows.filter((row) => row.stage === stage),
    }));
  }
  const valueOf = (row: R): string | null => {
    const values = row.fields && typeof row.fields === "object" ? row.fields : {};
    const value = (values as Record<string, unknown>)[field.key];
    return typeof value === "string" ? value : null;
  };
  const known = new Set(field.options.map((option) => option.value));
  return [
    ...field.options.map((option) => ({
      key: option.value,
      label: option.label,
      tone: option.tone,
      rows: rows.filter((row) => valueOf(row) === option.value),
    })),
    {
      key: KANBAN_NONE,
      label: null,
      tone: "neutral" as const,
      rows: rows.filter((row) => {
        const value = valueOf(row);
        return value === null || !known.has(value);
      }),
    },
  ];
}

/**
 * Filtres de la liste complète d'une colonne (« Voir les N autres ») : ceux de la vue, plus la
 * condition de la colonne. Les étapes « Prospects » et « Essai » sont approchées par le statut
 * (et l'étiquette « essai »), comme avant.
 */
export function kanbanColumnFilters(
  filters: SegmentFilters,
  groupKey: string,
  field: Pick<MemberField, "key"> | null,
): SegmentFilters {
  if (!field) {
    const stage = PIPELINE_STAGES.find((candidate) => candidate === groupKey) as
      PipelineStage | undefined;
    if (!stage) return filters;
    const status = stage === "lead" || stage === "trial" ? "prospect" : stage;
    return {
      ...filters,
      statuses: [status],
      ...(stage === "trial" ? { tags: ["essai"] } : {}),
    };
  }
  const condition: FieldCondition =
    groupKey === KANBAN_NONE
      ? { key: field.key, op: "is_empty" }
      : { key: field.key, op: "is", value: groupKey };
  const conditions = (filters.fields ?? []).filter((existing) => existing.key !== field.key);
  return { ...filters, fields: [...conditions, condition].slice(-MAX_FIELD_CONDITIONS) };
}

// ---------------------------------------------------------------------------
// Vues du planning
// ---------------------------------------------------------------------------

export const PLANNING_LAYOUTS = ["week", "day"] as const;
export type PlanningLayout = (typeof PLANNING_LAYOUTS)[number];
/** Couleur des séances : leur discipline, ou leur coach principal. */
export const PLANNING_COLORS = ["discipline", "coach"] as const;
export type PlanningColor = (typeof PLANNING_COLORS)[number];
export const DEFAULT_PLANNING_COLOR: PlanningColor = "discipline";

/** Filtres d'une vue du planning (combinés en ET ; une liste vaut « l'un de »). */
export const planningFiltersSchema = z
  .object({
    disciplines: z.array(z.guid()).max(50),
    coaches: z.array(z.guid()).max(50),
    rooms: z.array(z.guid()).max(50),
    /** Séances où l'utilisateur est coach. */
    mine: z.literal(true),
  })
  .partial()
  .strict();
export type PlanningFilters = z.infer<typeof planningFiltersSchema>;

/** Lit des filtres enregistrés : les clés et identifiants invalides sont ignorés. */
export function parsePlanningFilters(raw: unknown): PlanningFilters {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const filters: PlanningFilters = {};
  for (const key of ["disciplines", "coaches", "rooms"] as const) {
    const list = Array.isArray(source[key])
      ? [
          ...new Set(
            (source[key] as unknown[]).filter((id): id is string => z.guid().safeParse(id).success),
          ),
        ].slice(0, 50)
      : [];
    if (list.length) filters[key] = list;
  }
  if (source.mine === true) filters.mine = true;
  return filters;
}

export type PlanningView = {
  /** Slug d'une vue intégrée (`semaine`, `jour`), UUID d'une vue enregistrée. */
  id: string;
  name: string;
  builtin: boolean;
  layout: PlanningLayout;
  filters: PlanningFilters;
  color: PlanningColor;
  visibility: ViewVisibility;
  createdBy: string | null;
  position: number;
};

/** Vues intégrées du planning : les deux affichages d'origine (`?vue=semaine|jour`). */
export const BUILTIN_PLANNING_VIEWS = [
  { id: "semaine", layout: "week" },
  { id: "jour", layout: "day" },
] as const satisfies readonly { id: string; layout: PlanningLayout }[];
export type BuiltinPlanningViewId = (typeof BUILTIN_PLANNING_VIEWS)[number]["id"];

export function isBuiltinPlanningView(id: string): id is BuiltinPlanningViewId {
  return BUILTIN_PLANNING_VIEWS.some((view) => view.id === id);
}

export function builtinPlanningView(id: BuiltinPlanningViewId, name: string): PlanningView {
  return {
    id,
    name,
    builtin: true,
    layout: id === "jour" ? "day" : "week",
    filters: {},
    color: DEFAULT_PLANNING_COLOR,
    visibility: "team",
    createdBy: null,
    position: -1,
  };
}

/** Une ligne de `saved_views` (objet « planning ») : la couleur est rangée dans `group_by`. */
export function parsePlanningView(row: {
  id: string;
  name: string;
  layout: string;
  filters: unknown;
  group_by: string | null;
  visibility: string;
  created_by: string | null;
  position: number;
}): PlanningView {
  return {
    id: row.id,
    name: row.name,
    builtin: false,
    layout: row.layout === "day" ? "day" : "week",
    filters: parsePlanningFilters(row.filters),
    color: PLANNING_COLORS.find((color) => color === row.group_by) ?? DEFAULT_PLANNING_COLOR,
    visibility: row.visibility === "team" ? "team" : "private",
    createdBy: row.created_by,
    position: row.position,
  };
}

export type PlanningViewState = { filters: PlanningFilters; color: PlanningColor };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Paramètres d'URL des filtres du planning (`d` : disciplines, `c` : coachs, `s` : salles). */
export const PLANNING_FILTER_PARAMS = ["d", "c", "s", "mes", NO_FILTERS_PARAM] as const;

/** État de la page : la vue, corrigée par les paramètres d'URL présents (`?d=` d'avant compris). */
export function planningStateFromSearch(
  params: SearchParams,
  view: PlanningView,
): PlanningViewState {
  const ids = (key: string) => [...new Set(listParam(params, key).filter((id) => GUID.test(id)))];
  const fromUrl = PLANNING_FILTER_PARAMS.some(
    (key) => params[key] !== undefined && params[key] !== "",
  );
  const colorParam = first(params.couleur);
  return {
    filters: fromUrl
      ? parsePlanningFilters({
          disciplines: ids("d"),
          coaches: ids("c"),
          rooms: ids("s"),
          mine: first(params.mes) === "1" ? true : undefined,
        })
      : { ...view.filters },
    color: PLANNING_COLORS.find((color) => color === colorParam) ?? view.color,
  };
}

function samePlanningFilters(a: PlanningFilters, b: PlanningFilters): boolean {
  const canonical = (filters: PlanningFilters) =>
    JSON.stringify({
      d: [...(filters.disciplines ?? [])].sort(),
      c: [...(filters.coaches ?? [])].sort(),
      s: [...(filters.rooms ?? [])].sort(),
      m: filters.mine === true,
    });
  return canonical(a) === canonical(b);
}

export function hasPlanningFilters(filters: PlanningFilters): boolean {
  return Boolean(
    filters.disciplines?.length || filters.coaches?.length || filters.rooms?.length || filters.mine,
  );
}

/** L'état diffère-t-il de la vue (filtres, couleur) ? L'affichage appartient à la vue. */
export function isPlanningViewDirty(view: PlanningView, state: PlanningViewState): boolean {
  return !samePlanningFilters(view.filters, state.filters) || view.color !== state.color;
}

/** Paires d'URL des filtres du planning (une valeur par clé). */
export function planningFilterPairs(filters: PlanningFilters): [string, string][] {
  const pairs: [string, string][] = [];
  if (filters.disciplines?.length) pairs.push(["d", filters.disciplines.join(",")]);
  if (filters.coaches?.length) pairs.push(["c", filters.coaches.join(",")]);
  if (filters.rooms?.length) pairs.push(["s", filters.rooms.join(",")]);
  if (filters.mine) pairs.push(["mes", "1"]);
  return pairs;
}

/**
 * Paires d'URL des seuls écarts à la vue : filtres complets s'ils diffèrent (marqueur « aucun
 * filtre » si la vue en avait), puis la couleur. `vue`, `semaine` et `jour` sont ajoutés par la page.
 */
export function planningStatePairs(
  view: PlanningView,
  state: PlanningViewState,
): [string, string][] {
  const pairs: [string, string][] = [];
  if (!samePlanningFilters(view.filters, state.filters)) {
    const filterPairs = planningFilterPairs(state.filters);
    if (filterPairs.length) pairs.push(...filterPairs);
    else pairs.push([NO_FILTERS_PARAM, "1"]);
  }
  if (state.color !== view.color) pairs.push(["couleur", state.color]);
  return pairs;
}
