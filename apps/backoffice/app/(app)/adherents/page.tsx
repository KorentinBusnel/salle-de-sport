import { MEMBER_STATUS_TONE, type MemberStatus } from "@salle/shared";
import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/data-table/selection";
import { SortHead } from "@/components/data-table/sort-head";
import { ColumnsMenu, DataTableFrame } from "@/components/data-table/table-prefs";
import { Flash } from "@/components/flash";
import { ActivateButton } from "@/components/members/activate-button";
import { CreditsDialog } from "@/components/members/credits-dialog";
import { MemberRowMenu } from "@/components/members/member-row-menu";
import { MembersBulkBar } from "@/components/members/members-bulk-bar";
import { MembersSearch } from "@/components/members/members-search";
import { NewMemberSheet } from "@/components/members/new-member-sheet";
import { TagFilter } from "@/components/members/tag-filter";
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
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getCrmTodo } from "@/lib/nav-counts";
import { pageSizeOf } from "@/lib/pagination";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { adjustCredits, createMember } from "./actions";

export const metadata: Metadata = { title: t("members.title") };

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
/** Listes « CRM à compléter » de l'accueil (gérant) : `?a_faire=<kind>`. */
const TODO_KINDS = ["incomplete", "unanswered", "trials_to_call"] as const;
const SORTS = ["name", "name_desc", "recent", "status", "credits", "credits_desc"] as const;
type Sort = (typeof SORTS)[number];
const TABLE = "adherents";

type Search = {
  q?: string;
  statut?: string;
  tag?: string;
  page?: string;
  taille?: string;
  tri?: string;
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<
    Search & { ok?: string; nouveau?: string; a_faire?: string; erreur?: string }
  >;
}) {
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

  const search = (params.q ?? "").trim().slice(0, 80);
  const status = STATUSES.find((s) => s === params.statut);
  const tag = (params.tag ?? "").trim().toLowerCase().slice(0, 40);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const size = pageSizeOf(params.taille);
  const requested = SORTS.find((s) => s === params.tri) ?? "name";
  // Crédits : finances du gérant uniquement.
  const sort: Sort = !manager && requested.startsWith("credits") ? "name" : requested;

  const countFor = (s: MemberStatus) =>
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", context.gym.id)
      .eq("status", s);
  const todoKind = manager ? TODO_KINDS.find((k) => k === params.a_faire) : undefined;
  const todoIds = todoKind
    ? ((await getCrmTodo(context.gym.id)).find((row) => row.kind === todoKind)?.member_ids ?? [])
    : null;
  const [result, tagRows, ...counts] = await Promise.all([
    todoIds
      ? supabase
          .from("members")
          .select("id, first_name, last_name, email, phone, status, tags, created_at")
          .eq("gym_id", context.gym.id)
          .in("id", todoIds.length ? todoIds : ["00000000-0000-0000-0000-000000000000"])
          .order("last_name")
          .then(({ data, error }) => ({
            error,
            data: (data ?? []).map((m) => ({
              ...m,
              email: m.email ?? "",
              phone: m.phone ?? "",
              credits: null,
              total_count: data?.length ?? 0,
            })),
          }))
      : supabase.rpc("search_members", {
          p_gym_id: context.gym.id,
          ...(search ? { p_query: search } : {}),
          ...(status ? { p_statuses: [status] } : {}),
          ...(tag ? { p_tag: tag } : {}),
          p_limit: size,
          p_offset: (page - 1) * size,
          p_sort: sort,
        }),
    supabase
      .rpc("tag_suggestions", { p_gym_id: context.gym.id, p_query: "", p_limit: 30 })
      .then(({ data }) => data ?? []),
    ...STATUSES.map(countFor),
  ]);
  const statusCount = new Map(STATUSES.map((s, i) => [s, counts[i]?.count ?? 0]));
  const members = result.data ?? [];
  const total = members[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  const href = (overrides: Omit<Partial<Search>, "page"> & { page?: number }) => {
    const query = new URLSearchParams();
    const merged = {
      q: search,
      statut: status ?? "",
      tag,
      taille: size === 25 ? "" : String(size),
      tri: sort === "name" ? "" : sort,
      ...overrides,
      page: overrides.page && overrides.page > 1 ? String(overrides.page) : "",
    };
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
    const text = query.toString();
    return `/adherents${text ? `?${text}` : ""}`;
  };
  const returnQuery = href({ page }).split("?")[1] ?? "";
  const sortHref = (asc: Sort, desc: Sort) => href({ tri: sort === asc ? desc : asc });
  const directionOf = (asc: Sort, desc: Sort) =>
    sort === asc ? ("asc" as const) : sort === desc ? ("desc" as const) : null;

  const filters: { value: MemberStatus | undefined; label: string; count?: number }[] = [
    {
      value: "prospect",
      label: t("members.filterProspects"),
      count: statusCount.get("prospect") ?? 0,
    },
    { value: "active", label: t("members.filterActive"), count: statusCount.get("active") ?? 0 },
    {
      value: "suspended",
      label: t("members.filterSuspended"),
      count: statusCount.get("suspended") ?? 0,
    },
    {
      value: "cancelled",
      label: t("members.filterCancelled"),
      count: statusCount.get("cancelled") ?? 0,
    },
    { value: undefined, label: t("members.allStatuses") },
  ];
  const columns = [
    { key: "contact", label: t("members.contact") },
    { key: "status", label: t("members.status") },
    ...(manager ? [{ key: "credits", label: t("members.credits") }] : []),
  ];
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

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            {/* Défilement des onglets au téléphone sans élargir la colonne. */}
            <div className="w-full min-w-0 overflow-x-auto xl:w-auto">
              <nav
                aria-label={t("members.status")}
                className="flex w-fit gap-1 rounded-xl bg-muted p-1"
              >
                {filters.map((filter) => {
                  const active = filter.value === status;
                  return (
                    <Link
                      key={filter.label}
                      href={href({ statut: filter.value ?? "" })}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                        active
                          ? "bg-card font-medium text-foreground shadow-border"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {filter.label}
                      {filter.count !== undefined ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-xs tabular-nums",
                            filter.value === "prospect" && filter.count > 0
                              ? "bg-primary text-primary-foreground"
                              : "bg-background",
                          )}
                        >
                          {filter.count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <MembersSearch initial={search} />
              <div className="flex gap-2">
                <TagFilter tags={tagRows} value={tag} />
                <ColumnsMenu table={TABLE} columns={columns} />
              </div>
            </div>
          </div>

          {todoKind ? (
            <p className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-accent px-3 py-0.5 font-medium text-accent-foreground">
                {t(`members.todo.${todoKind}`)}
              </span>
              <Link
                href="/adherents"
                className="text-muted-foreground underline hover:text-foreground"
              >
                {t("members.clearTag")}
              </Link>
            </p>
          ) : null}
          <Flash ok={params.ok} error={params.erreur} />

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
                    {search
                      ? t("members.emptySearch", { query: search })
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
                        <SortHead
                          label={t("members.name")}
                          href={sortHref("name", "name_desc")}
                          direction={directionOf("name", "name_desc")}
                        />
                        <TableHead data-col="contact">{t("members.contact")}</TableHead>
                        <SortHead
                          col="status"
                          label={t("members.status")}
                          href={href({ tri: sort === "status" ? "" : "status" })}
                          direction={sort === "status" ? "asc" : null}
                        />
                        {manager ? (
                          <SortHead
                            col="credits"
                            label={t("members.credits")}
                            href={sortHref("credits_desc", "credits")}
                            direction={
                              sort === "credits_desc" ? "desc" : sort === "credits" ? "asc" : null
                            }
                            className="text-right"
                          />
                        ) : null}
                        <TableHead className="pr-4 text-right">
                          <span className="sr-only">{t("members.actions")}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const name = `${member.first_name} ${member.last_name}`;
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
                            <TableCell data-col="contact" className="text-muted-foreground">
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
                            <TableCell data-col="status">
                              <StatusPill tone={MEMBER_STATUS_TONE[member.status]}>
                                {t(`memberStatus.${member.status}`)}
                              </StatusPill>
                            </TableCell>
                            {manager ? (
                              <TableCell
                                data-col="credits"
                                className="text-right font-medium tabular-nums"
                              >
                                {member.credits ?? "—"}
                              </TableCell>
                            ) : null}
                            <TableCell className="pr-4">
                              <div className="flex items-center justify-end gap-1">
                                {member.status === "prospect" ? (
                                  <ActivateButton memberId={member.id} name={name} />
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
