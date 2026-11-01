import {
  BUILTIN_KANBAN_VIEWS,
  builtinKanbanView,
  DEFAULT_KANBAN_VIEW,
  filtersToPairs,
  groupKanban,
  hasFilters,
  isBuiltinKanbanView,
  isKanbanGroupField,
  isViewDirty,
  KANBAN_NONE,
  kanbanColumnFilters,
  kanbanGroupField,
  parseMemberField,
  parseMemberView,
  STAGE_GROUP,
  viewGroupBy,
  viewStateFromSearch,
  type MemberView,
} from "@salle/shared";
import type { Json } from "@salle/supabase";
import type { Metadata } from "next";
import Link from "next/link";
import { GroupBySelect } from "@/components/crm/group-by-select";
import { type BoardColumn, PipelineBoard } from "@/components/crm/pipeline-board";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/views/filter-bar";
import { ViewBar, type ViewTab } from "@/components/views/view-bar";
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { settingsHref } from "@/lib/settings-sections";
import { createClient } from "@/lib/supabase/server";
import { filtersToSearch } from "@/lib/segments";
import { moveMemberStage, moveMemberToOption } from "./actions";

export const metadata: Metadata = { title: t("crm.title") };

const PER_COLUMN = 25;

type Search = Record<string, string | string[] | undefined>;

/**
 * Pipeline en kanban : une vue (intégrée « Étapes » ou enregistrée) donne les filtres et le
 * groupement — étapes déduites des fiches (statut, réservations, tag « essai ») ou options d'un
 * champ liste. L'URL porte les écarts à la vue (filtres, `?groupe=`), comme sur Adhérents.
 */
export default async function CrmPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();

  const [viewsRes, fieldsRes, disciplinesRes] = await Promise.all([
    supabase
      .from("saved_views")
      .select(
        "id, name, layout, filters, sort, columns, group_by, visibility, created_by, position",
      )
      .eq("gym_id", context.gym.id)
      .eq("object", "members")
      .eq("layout", "kanban")
      .order("position")
      .order("name"),
    supabase
      .from("member_fields")
      .select("id, key, label, type, options, position, staff_can_edit, is_active")
      .eq("gym_id", context.gym.id)
      .eq("is_active", true)
      .order("position")
      .order("label"),
    supabase
      .from("disciplines")
      .select("id, name")
      .eq("gym_id", context.gym.id)
      .order("position")
      .order("name"),
  ]);
  const fields = (fieldsRes.data ?? []).flatMap((row) => {
    const field = parseMemberField(row);
    return field ? [field] : [];
  });
  const groupFields = fields.filter(isKanbanGroupField);
  const savedViews = (viewsRes.data ?? []).map((row) =>
    parseMemberView(
      row,
      fields.map((field) => field.key),
    ),
  );

  const requested = typeof params.vue === "string" ? params.vue : DEFAULT_KANBAN_VIEW;
  const builtin = () => builtinKanbanView(DEFAULT_KANBAN_VIEW, t("crm.viewStages"));
  const view: MemberView = isBuiltinKanbanView(requested)
    ? builtin()
    : (savedViews.find((saved) => saved.id === requested) ?? builtin());
  const state = viewStateFromSearch(params, view);
  const dirty = isViewDirty(view, state);
  // Groupement effectif : un champ liste actif, sinon les étapes (champ désactivé ou supprimé).
  const groupField = kanbanGroupField(state.groupBy, groupFields);
  const groupBy = groupField ? (state.groupBy ?? STAGE_GROUP) : STAGE_GROUP;

  const { data, error } = await supabase.rpc("crm_pipeline", {
    p_gym_id: context.gym.id,
    ...(hasFilters(state.filters) ? { p_filters: state.filters as Json } : {}),
  });
  if (error) throw new Error(error.message);

  const now = currentTime().getTime();
  const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const ago = (at: string | null) => {
    if (!at) return "";
    const days = Math.round((Date.parse(at) - now) / 86_400_000);
    return Math.abs(days) < 1 ? t("crm.today") : relative.format(days, "day");
  };
  const moreHref = (key: string) => {
    const query = new URLSearchParams([
      ["vue", "tous"],
      ...filtersToPairs(kanbanColumnFilters(state.filters, key, groupField)),
    ]);
    return `/adherents?${query.toString()}`;
  };

  const columns: BoardColumn[] = groupKanban(data ?? [], groupField).map((group) => ({
    key: group.key,
    label:
      group.label ??
      (group.key === KANBAN_NONE
        ? t("crm.noValue")
        : t(`crm.stage.${group.key as "lead" | "trial" | "active" | "suspended" | "cancelled"}`)),
    tone: group.tone,
    total: group.rows.length,
    cards: group.rows.slice(0, PER_COLUMN).map((row) => ({
      id: row.member_id,
      name: `${row.first_name} ${row.last_name}`,
      contact: row.email ?? row.phone ?? "—",
      bookings: row.bookings,
      lastActivity: ago(row.last_activity_at),
    })),
    moreHref: moreHref(group.key),
  }));

  const tabs: ViewTab[] = [
    ...BUILTIN_KANBAN_VIEWS.map((entry) => ({
      id: entry.id,
      name: t("crm.viewStages"),
      builtin: true,
      visibility: "team" as const,
    })),
    ...savedViews.map((saved) => ({
      id: saved.id,
      name: saved.name,
      builtin: false,
      visibility: saved.visibility,
    })),
  ];
  const segmentHref = hasFilters(state.filters)
    ? `/segments?${filtersToSearch(state.filters)}`
    : null;

  return (
    <UrlStateProvider>
      <div className="grid min-w-0 gap-6">
        <PageHeader
          title={t("crm.title")}
          description={groupField ? t("crm.hintField", { field: groupField.label }) : t("crm.hint")}
        />
        <ViewBar
          tabs={tabs}
          current={view}
          state={{ ...state, groupBy }}
          dirty={dirty}
          userId={context.userId}
          manager
          basePath="/crm"
          layout="kanban"
          segmentHref={segmentHref}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <FilterBar
            filters={state.filters}
            baseFilters={view.filters}
            disciplines={disciplinesRes.data ?? []}
            fields={fields}
            className="min-w-0 flex-1"
          />
          {groupFields.length ? (
            <GroupBySelect
              value={groupBy}
              viewDefault={viewGroupBy(view) ?? STAGE_GROUP}
              fields={groupFields.map((field) => ({ key: field.key, label: field.label }))}
            />
          ) : (
            <Link
              href={settingsHref("champs")}
              className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("crm.groupByHint")}
            </Link>
          )}
        </div>
        <Flash
          ok={typeof params.ok === "string" ? params.ok : undefined}
          error={typeof params.erreur === "string" ? params.erreur : undefined}
        />
        <PendingRegion>
          <PipelineBoard
            key={`${view.id}:${groupBy}`}
            columns={columns}
            mode={groupField ? { kind: "field", key: groupField.key } : { kind: "stage" }}
            moveStage={moveMemberStage}
            moveField={moveMemberToOption}
          />
        </PendingRegion>
      </div>
    </UrlStateProvider>
  );
}
