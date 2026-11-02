import {
  BUILTIN_MEMBER_VIEWS,
  builtinMemberView,
  DEFAULT_MEMBER_VIEW,
  fieldColumn,
  fieldKeyOfColumn,
  hasFilters,
  isBuiltinMemberView,
  isViewDirty,
  MEMBER_STATUS_TONE,
  parseMemberField,
  parseMemberView,
  viewStateFromSearch,
  viewStatePairs,
  type BuiltinMemberViewId,
  type MemberSort,
  type MemberStatus,
  type MemberView,
  type SegmentFilters,
} from "@salle/shared";
import type { Json } from "@salle/supabase";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/data-table/selection";
import { SortHead } from "@/components/data-table/sort-head";
import { ColumnsMenu, DataTableFrame } from "@/components/data-table/table-prefs";
import { Flash } from "@/components/flash";
import { ActivateButton } from "@/components/members/activate-button";
import { CreditsDialog } from "@/components/members/credits-dialog";
import { FieldValue } from "@/components/members/field-value";
import { MemberRowMenu } from "@/components/members/member-row-menu";
import { MembersBulkBar } from "@/components/members/members-bulk-bar";
import { MembersSearch } from "@/components/members/members-search";
import { NewMemberSheet } from "@/components/members/new-member-sheet";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/views/filter-bar";
import { ViewBar, type ViewTab } from "@/components/views/view-bar";
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { BUILTIN_VIEW_LABELS } from "@/lib/member-views";
import { getCrmTodo } from "@/lib/nav-counts";
import { pageSizeOf } from "@/lib/pagination";
import { filtersToSearch } from "@/lib/segments";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { adjustCredits, createMember } from "./actions";
import { createMemberView, updateMemberView } from "./vues-actions";

export const metadata: Metadata = { title: t("members.title") };

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
/** Listes « CRM à compléter » de l'accueil (gérant) : `?a_faire=<kind>`. */
const TODO_KINDS = ["incomplete", "unanswered", "trials_to_call"] as const;
const TABLE = "adherents";

/** Statut compté sur l'onglet d'une vue intégrée. */
const BUILTIN_STATUS: Partial<Record<BuiltinMemberViewId, MemberStatus>> = {
  "a-activer": "prospect",
  actifs: "active",
  suspendus: "suspended",
  resilies: "cancelled",
};

type Search = Record<string, string | string[] | undefined>;

/**
 * Adhérents : une vue (intégrée ou enregistrée) donne filtres, tri et colonnes ; l'URL porte
 * les écarts à cette vue (`viewStateFromSearch`), la recherche et la page. Les anciens liens
 * `?statut=` / `?tag=` restent compris comme des filtres.
 */
export default async function MembersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const context = await requireRole(isFrontDeskRole);
  const manager = isManagerRole(context.role);
  const config = await getGymConfig(context.gym.id);
  const settings = config.settings;
  const creditLimit = config.private.credit_adjust_max;
  // Stratégies de la salle : les actions désactivées ne sont pas proposées (la base refuse aussi).
  const canCreate = manager || settings.staff_can_create_members;
  const canSuspend = manager || settings.staff_can_suspend_members;
  const supabase = await createClient();

  const [viewsRes, fieldsRes, disciplinesRes] = await Promise.all([
    supabase
      .from("saved_views")
      .select(
        "id, name, layout, filters, sort, columns, group_by, visibility, created_by, position",
      )
      .eq("gym_id", context.gym.id)
      .eq("object", "members")
      .eq("layout", "table")
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
  const fieldKeys = fields.map((field) => field.key);
  const savedViews = (viewsRes.data ?? []).map((row) => parseMemberView(row, fieldKeys));
  const disciplines = disciplinesRes.data ?? [];

  // Vue ouverte : slug d'une vue intégrée ou identifiant d'une vue enregistrée.
  const requested = typeof params.vue === "string" ? params.vue : DEFAULT_MEMBER_VIEW;
  const builtin = (id: BuiltinMemberViewId) => builtinMemberView(id, t(BUILTIN_VIEW_LABELS[id]));
  const openedView: MemberView = isBuiltinMemberView(requested)
    ? builtin(requested)
    : (savedViews.find((saved) => saved.id === requested) ?? builtin(DEFAULT_MEMBER_VIEW));

  // Colonnes disponibles ; crédits (colonne, tri, filtre) : finances du gérant uniquement.
  const availableColumns = [
    { key: "contact", label: t("members.contact") },
    { key: "status", label: t("members.status") },
    ...(manager ? [{ key: "credits", label: t("members.credits") }] : []),
    ...fields.map((field) => ({ key: fieldColumn(field.key), label: field.label })),
  ];
  const availableKeys = availableColumns.map((column) => column.key);
  // La vue telle que ce rôle peut la voir : c'est elle que l'URL et « Modifiée » comparent, sinon
  // l'accueil verrait une vue intégrée « Modifiée » dès un tri ou une page (colonne crédits).
  const forRole = <T extends { columns: string[]; sort: MemberSort; filters: SegmentFilters }>(
    value: T,
  ): T => {
    if (manager)
      return { ...value, columns: value.columns.filter((k) => availableKeys.includes(k)) };
    const filters = { ...value.filters };
    delete filters.max_credits;
    return {
      ...value,
      columns: value.columns.filter((k) => availableKeys.includes(k)),
      sort: value.sort.startsWith("credits") ? "name" : value.sort,
      filters,
    };
  };
  const view = forRole(openedView);
  const state = forRole(viewStateFromSearch(params, view));
  const dirty = isViewDirty(view, state);
  const visible = availableKeys.filter((key) => state.columns.includes(key));
  const sort: MemberSort = state.sort;

  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);
  const size = pageSizeOf(typeof params.taille === "string" ? params.taille : undefined);

  const countFor = (status: MemberStatus) =>
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", context.gym.id)
      .eq("status", status);
  const todoKind = manager ? TODO_KINDS.find((kind) => kind === params.a_faire) : undefined;
  const todoIds = todoKind
    ? ((await getCrmTodo(context.gym.id)).find((row) => row.kind === todoKind)?.member_ids ?? [])
    : null;
  const [result, ...counts] = await Promise.all([
    todoIds
      ? supabase
          .from("members")
          .select("id, first_name, last_name, email, phone, status, tags, created_at")
          .eq("gym_id", context.gym.id)
          .in("id", todoIds.length ? todoIds : ["00000000-0000-0000-0000-000000000000"])
          .order("last_name")
          .then(async ({ data, error }) => {
            // Liste réservée au gérant : soldes lus comme search_members (somme du registre).
            const balances = data?.length
              ? await creditBalances(
                  supabase,
                  data.map((m) => m.id),
                )
              : null;
            return {
              error,
              data: (data ?? []).map((m) => ({
                ...m,
                email: m.email ?? "",
                phone: m.phone ?? "",
                credits: balances ? (balances.get(m.id) ?? 0) : null,
                // Même forme que search_members : valeurs des champs personnalisés par clé.
                fields: {} as Json,
                total_count: data?.length ?? 0,
              })),
            };
          })
      : supabase.rpc("search_members", {
          p_gym_id: context.gym.id,
          ...(state.query ? { p_query: state.query } : {}),
          ...(hasFilters(state.filters) ? { p_filters: state.filters as Json } : {}),
          p_limit: size,
          p_offset: (page - 1) * size,
          p_sort: sort,
        }),
    ...STATUSES.map(countFor),
  ]);
  const statusCount = new Map(STATUSES.map((status, i) => [status, counts[i]?.count ?? 0]));
  const members = result.data ?? [];
  const total = members[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  // Adresses : la vue et ses écarts, puis la taille, la page et la liste « à faire ».
  const href = (overrides: { page?: number; tri?: MemberSort }) => {
    const query = new URLSearchParams(
      viewStatePairs(view, { ...state, sort: overrides.tri ?? sort }),
    );
    if (size !== 25) query.set("taille", String(size));
    if (todoKind) query.set("a_faire", todoKind);
    if (overrides.page && overrides.page > 1) query.set("page", String(overrides.page));
    const text = query.toString();
    return `/adherents${text ? `?${text}` : ""}`;
  };
  const returnQuery = href({ page }).split("?")[1] ?? "";
  const sortHref = (asc: MemberSort, desc: MemberSort) => href({ tri: sort === asc ? desc : asc });
  const directionOf = (asc: MemberSort, desc: MemberSort) =>
    sort === asc ? ("asc" as const) : sort === desc ? ("desc" as const) : null;
  // En-tête triable ; liste « à faire » : ordre fixe (par nom), en-têtes sans lien de tri.
  const head = (
    key: string,
    label: string,
    target: string,
    direction: "asc" | "desc" | null,
    className?: string,
  ) =>
    todoKind ? (
      <TableHead key={key} className={className}>
        {label}
      </TableHead>
    ) : (
      <SortHead key={key} label={label} href={target} direction={direction} className={className} />
    );

  const tabs: ViewTab[] = [
    ...BUILTIN_MEMBER_VIEWS.map((entry) => {
      const status = BUILTIN_STATUS[entry.id];
      const count = status ? (statusCount.get(status) ?? 0) : undefined;
      return {
        id: entry.id,
        name: t(BUILTIN_VIEW_LABELS[entry.id]),
        builtin: true,
        visibility: "team" as const,
        count,
        highlight: entry.id === "a-activer" && (count ?? 0) > 0,
      };
    }),
    ...savedViews.map((saved) => ({
      id: saved.id,
      name: saved.name,
      builtin: false,
      visibility: saved.visibility,
    })),
  ];
  const segmentHref =
    manager && hasFilters(state.filters) ? `/segments?${filtersToSearch(state.filters)}` : null;
  const ids = members.map((m) => m.id);

  return (
    <UrlStateProvider>
      <SelectionProvider resetKey={returnQuery}>
        <div className="grid gap-6">
          <PageHeader
            title={t("members.title")}
            description={t("members.count", { count: total })}
            actions={
              canCreate ? (
                <NewMemberSheet action={createMember} defaultOpen={params.nouveau === "1"} />
              ) : undefined
            }
          />

          {todoKind ? (
            // Liste « à faire » de l'accueil : sa propre sélection, par nom ; vues, filtres,
            // recherche et tri n'y ont pas cours, ils ne sont donc pas proposés.
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-base font-semibold">{t(`members.todo.${todoKind}`)}</h2>
                <Link
                  href="/adherents"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:py-2"
                >
                  <ArrowLeftIcon aria-hidden className="size-3.5 self-center" />
                  {t("members.todoBack")}
                </Link>
              </div>
              <ColumnsMenu table={TABLE} columns={availableColumns} visible={visible} />
            </div>
          ) : (
            <>
              <ViewBar
                tabs={tabs}
                current={view}
                saveState={{
                  filters: state.filters,
                  sort: state.sort,
                  columns: state.columns,
                  group_by: null,
                }}
                dirty={dirty}
                userId={context.userId}
                manager={manager}
                basePath="/adherents"
                // Recherche et taille de page gardées en changeant de vue.
                tabQuery={
                  new URLSearchParams([
                    ...(state.query ? [["q", state.query]] : []),
                    ...(size !== 25 ? [["taille", String(size)]] : []),
                  ]).toString() || undefined
                }
                layout="table"
                create={createMemberView}
                update={updateMemberView}
                segmentHref={segmentHref}
              />

              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <FilterBar
                  canFilterCredits={manager}
                  filters={state.filters}
                  baseFilters={view.filters}
                  disciplines={disciplines}
                  fields={fields}
                  className="min-w-0 flex-1"
                />
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <MembersSearch initial={state.query} />
                  <ColumnsMenu table={TABLE} columns={availableColumns} visible={visible} />
                </div>
              </div>
            </>
          )}

          <Flash
            ok={typeof params.ok === "string" ? params.ok : undefined}
            error={typeof params.erreur === "string" ? params.erreur : undefined}
          />

          <PendingRegion>
            {result.error ? (
              <p className="text-destructive">{t("members.loadError")}</p>
            ) : members.length === 0 ? (
              <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>{t("members.empty")}</EmptyTitle>
                  <EmptyDescription>
                    {state.query
                      ? t("members.emptySearch", { query: state.query })
                      : t("members.emptyFilter")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTableFrame table={TABLE}>
                <div className="overflow-x-auto rounded-xl bg-card shadow-border">
                  <Table className="min-w-[44rem]">
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-10 pl-4">
                          <AllCheckbox ids={ids} label={t("table.selectAll")} />
                        </TableHead>
                        {head(
                          "name",
                          t("members.name"),
                          sortHref("name", "name_desc"),
                          directionOf("name", "name_desc"),
                        )}
                        {visible.map((column) => {
                          if (column === "contact")
                            return <TableHead key={column}>{t("members.contact")}</TableHead>;
                          if (column === "status")
                            return head(
                              column,
                              t("members.status"),
                              href({ tri: sort === "status" ? view.sort : "status" }),
                              sort === "status" ? "asc" : null,
                            );
                          if (column === "credits")
                            return head(
                              column,
                              t("members.credits"),
                              sortHref("credits_desc", "credits"),
                              sort === "credits_desc" ? "desc" : sort === "credits" ? "asc" : null,
                              "text-right",
                            );
                          const key = fieldKeyOfColumn(column);
                          const field = fields.find((f) => f.key === key);
                          return <TableHead key={column}>{field?.label ?? column}</TableHead>;
                        })}
                        <TableHead className="pr-4 text-right">
                          <span className="sr-only">{t("members.actions")}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const name = `${member.first_name} ${member.last_name}`;
                        const values =
                          member.fields && typeof member.fields === "object"
                            ? (member.fields as Record<string, unknown>)
                            : {};
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="pl-4">
                              <RowCheckbox id={member.id} label={t("table.select", { name })} />
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-3">
                                <Avatar className="size-8">
                                  <AvatarFallback className="text-xs">
                                    {initials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="grid min-w-0">
                                  <Link
                                    href={`/adherents/${member.id}`}
                                    className="font-medium hover:underline"
                                  >
                                    {member.last_name}{" "}
                                    <span className="font-normal">{member.first_name}</span>
                                  </Link>
                                  {member.tags.length ? (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {member.tags.join(" · ")}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </TableCell>
                            {visible.map((column) => {
                              if (column === "contact")
                                return (
                                  <TableCell key={column} className="text-muted-foreground">
                                    {member.email ? (
                                      <a
                                        href={`mailto:${member.email}`}
                                        className="block hover:text-foreground hover:underline"
                                      >
                                        {member.email}
                                      </a>
                                    ) : null}
                                    {member.phone ? (
                                      <a
                                        href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                                        className="block tabular-nums hover:text-foreground hover:underline"
                                      >
                                        {member.phone}
                                      </a>
                                    ) : null}
                                  </TableCell>
                                );
                              if (column === "status")
                                return (
                                  <TableCell key={column}>
                                    <StatusPill tone={MEMBER_STATUS_TONE[member.status]}>
                                      {t(`memberStatus.${member.status}`)}
                                    </StatusPill>
                                  </TableCell>
                                );
                              if (column === "credits")
                                return (
                                  <TableCell
                                    key={column}
                                    className="text-right font-medium tabular-nums"
                                  >
                                    {member.credits ?? "—"}
                                  </TableCell>
                                );
                              const key = fieldKeyOfColumn(column);
                              const field = fields.find((f) => f.key === key);
                              return (
                                <TableCell key={column}>
                                  {field && key ? (
                                    <FieldValue
                                      field={field}
                                      value={values[key]}
                                      timeZone={context.gym.timezone}
                                    />
                                  ) : null}
                                </TableCell>
                              );
                            })}
                            <TableCell className="pr-4">
                              <div className="flex items-center justify-end gap-1">
                                {member.status === "prospect" ? (
                                  <ActivateButton
                                    memberId={member.id}
                                    name={name}
                                    variant="outline"
                                  />
                                ) : null}
                                {manager ? (
                                  <CreditsDialog
                                    memberId={member.id}
                                    memberName={name}
                                    balance={member.credits ?? 0}
                                    returnQuery={returnQuery}
                                    canRemove={settings.manager_can_remove_credits}
                                    limit={creditLimit}
                                    action={adjustCredits}
                                  />
                                ) : null}
                                <MemberRowMenu
                                  memberId={member.id}
                                  name={name}
                                  status={member.status}
                                  canSuspend={canSuspend}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </DataTableFrame>
            )}
          </PendingRegion>

          {members.length > 0 && !todoKind ? (
            <DataTablePagination
              page={page}
              pages={pages}
              total={total}
              size={size}
              hrefFor={(p) => href({ page: p })}
            />
          ) : null}
        </div>
        <MembersBulkBar
          statuses={Object.fromEntries(members.map((m) => [m.id, m.status]))}
          canExport={manager}
        />
      </SelectionProvider>
    </UrlStateProvider>
  );
}

/**
 * Soldes de crédits de quelques fiches (somme du registre, lisible du seul gérant), comme
 * `search_members` ; lus par pages, l'API plafonnant le nombre de lignes. `null` en cas d'échec.
 */
async function creditBalances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberIds: string[],
) {
  const balances = new Map<string, number>();
  for (let from = 0; ;) {
    const { data, error } = await supabase
      .from("credit_ledger")
      .select("id, member_id, delta")
      .in("member_id", memberIds)
      .order("id")
      .range(from, from + 999);
    if (error) return null;
    if (data.length === 0) return balances;
    for (const row of data)
      balances.set(row.member_id, (balances.get(row.member_id) ?? 0) + row.delta);
    from += data.length;
  }
}
