import { z } from "zod";
import { parseSegmentFilters, segmentFiltersSchema, type SegmentFilters } from "./crm.ts";
import { FIELD_KEY_PATTERN } from "./fields.ts";

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
};

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
  return {
    filters: fromUrl ?? { ...view.filters },
    sort: MEMBER_SORTS.find((sort) => sort === sortParam) ?? view.sort,
    columns,
    query: (first(params.q) ?? "").trim().slice(0, 80),
  };
}

/** L'état diffère-t-il de la vue (filtres, tri, colonnes ; la recherche n'en fait pas partie) ? */
export function isViewDirty(view: MemberView, state: MemberViewState): boolean {
  return (
    !sameFilters(view.filters, state.filters) ||
    view.sort !== state.sort ||
    view.columns.join(",") !== state.columns.join(",")
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
  if (state.query) pairs.push(["q", state.query]);
  return pairs;
}
