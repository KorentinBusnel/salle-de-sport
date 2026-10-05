import { MEMBER_STATUS_TONE, type MemberStatus } from "@salle/shared";
import { SearchIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Flash } from "@/components/flash";
import { CreditsDialog } from "@/components/members/credits-dialog";
import { NewMemberSheet } from "@/components/members/new-member-sheet";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getCrmTodo } from "@/lib/nav-counts";
import { adjustCredits, createMember, setMemberStatus } from "./actions";

export const metadata: Metadata = { title: t("members.title") };

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
/** Listes « CRM à compléter » de l'accueil (gérant) : `?a_faire=<kind>`. */
const TODO_KINDS = ["incomplete", "unanswered", "trials_to_call"] as const;
const PAGE_SIZE = 25;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    statut?: string;
    tag?: string;
    page?: string;
    ok?: string;
    nouveau?: string;
    a_faire?: string;
    erreur?: string;
  }>;
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
  const [result, ...counts] = await Promise.all([
    todoIds
      ? supabase
          .from("members")
          .select("id, first_name, last_name, email, phone, status, tags")
          .eq("gym_id", context.gym.id)
          .in("id", todoIds.length ? todoIds : ["00000000-0000-0000-0000-000000000000"])
          .order("last_name")
          .then(({ data, error }) => ({
            error,
            data: (data ?? []).map((m) => ({
              ...m,
              email: m.email ?? "",
              phone: m.phone ?? "",
              total_count: data?.length ?? 0,
            })),
          }))
      : supabase.rpc("search_members", {
          p_gym_id: context.gym.id,
          ...(search ? { p_query: search } : {}),
          ...(status ? { p_statuses: [status] } : {}),
          ...(tag ? { p_tag: tag } : {}),
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        }),
    ...STATUSES.map(countFor),
  ]);
  const statusCount = new Map(STATUSES.map((s, i) => [s, counts[i]?.count ?? 0]));
  const members = result.data ?? [];
  const total = members[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Solde de crédits (gérant uniquement : la RLS réserve le registre aux finances).
  const balances = new Map<string, number>();
  if (manager && members.length) {
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("member_id, delta")
      .in(
        "member_id",
        members.map((m) => m.id),
      );
    for (const row of ledger ?? [])
      balances.set(row.member_id, (balances.get(row.member_id) ?? 0) + row.delta);
  }

  const href = (overrides: { q?: string; statut?: string; page?: number }) => {
    const query = new URLSearchParams();
    const q = overrides.q ?? search;
    const st = "statut" in overrides ? overrides.statut : status;
    const pg = overrides.page ?? 1;
    if (q) query.set("q", q);
    if (st) query.set("statut", st);
    if (tag) query.set("tag", tag);
    if (pg > 1) query.set("page", String(pg));
    const text = query.toString();
    return `/adherents${text ? `?${text}` : ""}`;
  };
  const returnQuery = href({ page }).split("?")[1] ?? "";

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

  return (
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label={t("members.status")}
          className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1"
        >
          {filters.map((filter) => {
            const active = filter.value === status;
            return (
              <Link
                key={filter.label}
                href={href({ statut: filter.value ?? "" })}
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

        <form role="search" className="w-full lg:max-w-sm">
          {status ? <input type="hidden" name="statut" value={status} /> : null}
          <InputGroup className="bg-card">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t("members.searchPlaceholder")}
              aria-label={t("members.searchPlaceholder")}
            />
          </InputGroup>
        </form>
      </div>

      {todoKind ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-accent px-3 py-0.5 font-medium text-accent-foreground">
            {t(`members.todo.${todoKind}`)}
          </span>
          <Link href="/adherents" className="text-muted-foreground underline hover:text-foreground">
            {t("members.clearTag")}
          </Link>
        </p>
      ) : null}
      {tag ? (
        <p className="flex items-center gap-2 text-sm">
          {t("members.taggedWith")}
          <span className="rounded-full bg-muted px-3 py-0.5">{tag}</span>
          <Link
            href={`/adherents${status ? `?statut=${status}` : ""}`}
            className="text-muted-foreground underline hover:text-foreground"
          >
            {t("members.clearTag")}
          </Link>
        </p>
      ) : null}
      <Flash ok={params.ok} error={params.erreur} />

      {result.error ? (
        <p className="text-destructive">{t("members.loadError")}</p>
      ) : members.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>{t("members.empty")}</EmptyTitle>
            <EmptyDescription>
              {search ? t("members.emptySearch", { query: search }) : t("members.emptyFilter")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-border">
          <Table className="min-w-[42rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">{t("members.name")}</TableHead>
                <TableHead>{t("members.contact")}</TableHead>
                <TableHead>{t("members.status")}</TableHead>
                {manager ? (
                  <TableHead className="text-right">{t("members.credits")}</TableHead>
                ) : null}
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">{t("members.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const name = `${member.first_name} ${member.last_name}`;
                const balance = balances.get(member.id) ?? 0;
                return (
                  <TableRow key={member.id}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <span className="grid">
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
                    <TableCell className="text-muted-foreground">
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
                    <TableCell>
                      <StatusPill tone={MEMBER_STATUS_TONE[member.status]}>
                        {t(`memberStatus.${member.status}`)}
                      </StatusPill>
                    </TableCell>
                    {manager ? (
                      <TableCell className="text-right font-medium tabular-nums">
                        {balance}
                      </TableCell>
                    ) : null}
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-2">
                        {member.status === "prospect" ? (
                          <form action={setMemberStatus}>
                            <input type="hidden" name="memberId" value={member.id} />
                            <input type="hidden" name="status" value="active" />
                            <input type="hidden" name="returnQuery" value={returnQuery} />
                            <SubmitButton
                              size="sm"
                              aria-label={t("members.activateName", { name })}
                            >
                              {t("members.activate")}
                            </SubmitButton>
                          </form>
                        ) : member.status === "active" && canSuspend ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="ghost">
                                {t("members.suspend")}
                              </Button>
                            }
                            title={t("members.suspendTitle")}
                            description={t("members.suspendBody", { name })}
                            confirmLabel={t("members.suspend")}
                            action={setMemberStatus}
                            fields={{ memberId: member.id, status: "suspended", returnQuery }}
                          />
                        ) : member.status === "suspended" && canSuspend ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="outline">
                                {t("members.reactivate")}
                              </Button>
                            }
                            title={t("members.reactivateTitle")}
                            description={t("members.reactivateBody", { name })}
                            confirmLabel={t("members.reactivate")}
                            action={setMemberStatus}
                            fields={{ memberId: member.id, status: "active", returnQuery }}
                          />
                        ) : null}
                        {manager ? (
                          <CreditsDialog
                            memberId={member.id}
                            memberName={name}
                            balance={balance}
                            returnQuery={returnQuery}
                            canRemove={settings.manager_can_remove_credits}
                            limit={creditLimit}
                            action={adjustCredits}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label={t("ui.pagination")}>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page <= 1 && "pointer-events-none opacity-50")}
          >
            <Link href={href({ page: page - 1 })} aria-disabled={page <= 1}>
              {t("ui.previous")}
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {t("members.page", { page, pages })}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page >= pages && "pointer-events-none opacity-50")}
          >
            <Link href={href({ page: page + 1 })} aria-disabled={page >= pages}>
              {t("ui.next")}
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
