import {
  canSeeFinancials,
  coachesLabel,
  deskWindows,
  type HomeBlock,
  homeBlocksFor,
  isStaffRole,
  openingIntervals,
  sessionPhase,
  uncoveredIntervals,
  zonedDateKey,
  zonedDayRange,
} from "@salle/shared";
import { CalculatorIcon, CalendarXIcon, NotebookPenIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DeskShiftDialog } from "@/components/desk/desk-shift-dialog";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { AssistantButton } from "@/components/today/assistant-button";
import { DailyBrief } from "@/components/today/daily-brief";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { getTodayDigest } from "@/lib/digest";
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getTeamOptions } from "@/lib/team";
import { cn } from "@/lib/utils";
import { getCrmTodo } from "@/lib/nav-counts";
import { getGymConfig } from "@/lib/settings";

export const metadata: Metadata = { title: t("nav.today") };

const CRM_LINKS = {
  incomplete: {
    label: "today.crm.incomplete",
    hint: "today.crm.incompleteHint",
    cta: "today.crm.complete",
  },
  unanswered: {
    label: "today.crm.unanswered",
    hint: "today.crm.unansweredHint",
    cta: "today.crm.answer",
  },
  trials_to_call: {
    label: "today.crm.trials",
    hint: "today.crm.trialsHint",
    cta: "today.crm.call",
  },
} as const;

/**
 * Accueil orienté action : brief du jour (gérant), puis Opérations (remplissage, essais du
 * jour, permanence à l'accueil, séances), Clients (nouveaux venus, CRM à compléter) et Finance
 * (impayés, factures). Chaque rôle ne voit que ce que la RLS lui ouvre.
 */
export default async function DashboardPage() {
  const context = await requireTeamContext();
  const supabase = await createClient();
  const now = currentTime();
  const tz = context.gym.timezone;
  const { start, end } = zonedDayRange(now, tz);
  const today = zonedDateKey(now, tz);
  const isCoachOnly = context.role === "coach";
  const manager = canSeeFinancials(context.role);
  const frontDesk = isStaffRole(context.role) && !isCoachOnly;
  const configured = manager && aiEnv().apiKey !== null;
  const format = gymFormatters(tz);
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  const [
    sessionsResult,
    trialsResult,
    shiftsResult,
    todoResult,
    unpaidResult,
    digest,
    team,
    config,
  ] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), session_coaches(position, coaches(display_name, profile_id)), bookings(status)",
      )
      .eq("gym_id", context.gym.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    supabase.rpc("today_trials", { p_gym_id: context.gym.id, p_day: today }),
    supabase
      .from("desk_shifts")
      .select(
        "id, profile_id, starts_at, ends_at, note, profiles!desk_shifts_profile_id_fkey(first_name, last_name)",
      )
      .eq("gym_id", context.gym.id)
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .order("starts_at"),
    manager ? getCrmTodo(context.gym.id) : [],
    manager ? supabase.rpc("unpaid_members", { p_gym_id: context.gym.id }) : null,
    configured ? getTodayDigest(context) : null,
    manager ? getTeamOptions(context) : [],
    getGymConfig(context.gym.id),
  ]);

  if (sessionsResult.error) {
    return <p className="text-destructive">{t("dashboard.loadError")}</p>;
  }

  const sessions = sessionsResult.data.map((session) => {
    const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), now);
    // Réservations lisibles : toutes pour l'accueil, celles de ses cours pour un coach (RLS).
    const toCheck =
      session.status === "scheduled" && phase !== "upcoming"
        ? session.bookings.filter((b) => b.status === "confirmed").length
        : 0;
    const mine = session.session_coaches.some((sc) => sc.coaches?.profile_id === context.userId);
    return { ...session, phase, toCheck, mine };
  });

  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const counted = isCoachOnly ? scheduled.filter((s) => s.mine) : scheduled;
  const booked = counted.reduce((sum, s) => sum + s.booked_count, 0);
  const capacity = counted.reduce((sum, s) => sum + s.capacity, 0);
  const waitlist = counted.reduce((sum, s) => sum + s.waitlist_count, 0);
  const toCheck = counted.reduce((sum, s) => sum + s.toCheck, 0);
  // Séance à venir la moins remplie : candidate à une relance.
  const emptiest = counted
    .filter((s) => s.phase === "upcoming" && s.capacity > s.booked_count)
    .sort((a, b) => a.booked_count / a.capacity - b.booked_count / b.capacity)[0];

  const trials = trialsResult.data ?? [];
  const trialSessions = [...new Map(trials.map((row) => [row.session_id, row])).values()].map(
    (first) => ({ ...first, people: trials.filter((row) => row.session_id === first.session_id) }),
  );
  const newcomers = [...new Map(trials.map((row) => [row.member_id, row])).values()];

  const shifts = shiftsResult.data ?? [];
  // Présence attendue : horaires d'ouverture du jour, sinon séances ± marge (réglages).
  const gaps = uncoveredIntervals(
    deskWindows(scheduled, {
      opening: openingIntervals(config.openingHours, today, tz),
      marginMinutes: config.private.desk_margin_minutes,
    }),
    shifts,
    config.private.desk_min_gap_minutes,
  );
  const todo = todoResult;
  const todoTotal = todo.reduce((sum, row) => sum + row.total, 0);
  const unpaid = unpaidResult?.data ?? [];
  const unpaidTotal = unpaid.reduce((sum, row) => sum + row.amount_cents, 0);
  const actions = toCheck + gaps.length + todoTotal + unpaid.length;
  const firstName = context.displayName.split(" ")[0] ?? context.displayName;
  const clock = (date: Date | string) => format.time(date);
  const draftFor = (from: Date, to: Date) => ({
    date: today,
    start: clock(from).replace(" h ", ":"),
    end: clock(to).replace(" h ", ":"),
  });

  const list = (
    <section className="grid gap-3" aria-labelledby="seances-du-jour">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="seances-du-jour" className="font-semibold">
          {t("dashboard.sessionsToday")}
        </h3>
        <Link href="/planning" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("dashboard.seeWeek")}
        </Link>
      </div>
      {sessions.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarXIcon />
            </EmptyMedia>
            <EmptyTitle>{t("dashboard.noSessions")}</EmptyTitle>
            <EmptyDescription>{t("dashboard.noSessionsHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card shadow-border">
          {sessions.map((session) => (
            <li key={session.id} className="border-t border-border/70 first:border-t-0">
              <Link
                href={`/planning/${session.id}`}
                className={cn(
                  "grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:bg-accent focus-visible:outline-none sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_auto]",
                  (session.phase === "past" || session.status === "cancelled") &&
                    "text-muted-foreground",
                )}
              >
                <span className="text-sm tabular-nums">
                  <span className="block font-medium text-foreground">
                    {format.time(session.starts_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format.time(session.ends_at)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <DisciplineChip
                    name={session.disciplines?.name ?? ""}
                    color={session.disciplines?.color}
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    {coachesLabel(
                      [...session.session_coaches]
                        .sort((a, b) => a.position - b.position)
                        .flatMap((sc) => (sc.coaches ? [sc.coaches.display_name] : [])),
                    )}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  {session.status === "cancelled" ? (
                    <StatusPill tone="danger">{t("dashboard.cancelled")}</StatusPill>
                  ) : session.toCheck > 0 ? (
                    <StatusPill tone="warning">
                      {t("dashboard.sessionToCheck", { count: session.toCheck })}
                    </StatusPill>
                  ) : (
                    <StatusPill
                      tone={session.phase === "live" ? "success" : "neutral"}
                      className={session.phase === "live" ? "[&>span]:animate-pulse" : undefined}
                    >
                      {t(`dashboard.phase.${session.phase}`)}
                    </StatusPill>
                  )}
                </span>
                {session.status === "scheduled" ? (
                  <span className="col-span-3 flex items-center gap-3 sm:col-span-1 sm:justify-end">
                    <OccupancyMeter
                      booked={session.booked_count}
                      capacity={session.capacity}
                      label={t("dashboard.fillRate")}
                      className="flex-1 sm:w-24 sm:flex-none"
                    />
                    <span className="min-w-12 text-right text-sm whitespace-nowrap text-foreground tabular-nums">
                      {t("dashboard.places", {
                        booked: session.booked_count,
                        capacity: session.capacity,
                      })}
                    </span>
                    {session.waitlist_count > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("dashboard.waitlist", { count: session.waitlist_count })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // Blocs de l'accueil : ceux du rôle, dans l'ordre réglé par le gérant (Paramètres › Accueil).
  const blocks: Record<HomeBlock, ReactNode> = {
    brief: configured ? <DailyBrief key="brief" digest={digest} /> : null,
    operations: (
      <section key="operations" aria-labelledby="operations" className="grid gap-4">
        <SectionTitle id="operations" href="/planning" link={t("today.dayPlanning")}>
          {t("today.operations")}
        </SectionTitle>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel
            title={t("today.fill")}
            aside={
              <span className="text-2xl font-semibold tabular-nums">
                {capacity ? `${Math.round((booked / capacity) * 100)} %` : "—"}
              </span>
            }
          >
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("dashboard.seats", { booked, capacity })}
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{t("dashboard.toCheck")}</dt>
                <dd className="text-lg font-semibold tabular-nums">{toCheck}</dd>
              </div>
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{t("dashboard.waitlistTotal")}</dt>
                <dd className="text-lg font-semibold tabular-nums">{waitlist}</dd>
              </div>
            </dl>
            {emptiest ? (
              <div className="grid gap-2 rounded-lg border border-dashed p-3 text-sm">
                <p>
                  {t("today.emptiest", {
                    discipline: emptiest.disciplines?.name ?? "",
                    time: clock(emptiest.starts_at),
                    booked: emptiest.booked_count,
                    capacity: emptiest.capacity,
                  })}
                </p>
                {configured ? (
                  <AssistantButton
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    prompt={t("today.fillPrompt", {
                      discipline: emptiest.disciplines?.name ?? "",
                      time: clock(emptiest.starts_at),
                      booked: emptiest.booked_count,
                      capacity: emptiest.capacity,
                      id: emptiest.id,
                    })}
                  >
                    {t("today.fillAction")}
                  </AssistantButton>
                ) : (
                  <Link
                    href={`/planning/${emptiest.id}`}
                    className="w-fit font-medium text-primary hover:underline"
                  >
                    {t("today.openSession")}
                  </Link>
                )}
              </div>
            ) : null}
          </Panel>

          <Panel
            title={t("today.trials")}
            aside={
              trials.length ? (
                <StatusPill tone="warning">
                  {t("today.trialsCount", { count: newcomers.length })}
                </StatusPill>
              ) : null
            }
          >
            {trialSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.trialsEmpty")}</p>
            ) : (
              <ul
                className="-mr-2 grid max-h-80 gap-2 overflow-y-auto overscroll-contain pr-2"
                tabIndex={0}
                aria-label={t("today.trials")}
              >
                {trialSessions.map((session) => (
                  <li
                    key={session.session_id}
                    className="grid gap-2 rounded-lg bg-muted/60 p-3 text-sm"
                  >
                    <Link
                      href={`/planning/${session.session_id}`}
                      className="flex flex-wrap items-center gap-2 hover:underline"
                    >
                      <span className="font-semibold tabular-nums">{clock(session.starts_at)}</span>
                      <DisciplineChip name={session.discipline} color={session.color} />
                      {session.coaches ? (
                        <span className="text-muted-foreground">{session.coaches}</span>
                      ) : null}
                    </Link>
                    <ul className="grid gap-1.5">
                      {session.people.map((person) => (
                        <li key={person.member_id} className="grid gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/adherents/${person.member_id}`}
                              className="font-medium hover:underline"
                            >
                              {person.first_name} {person.last_name}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {person.is_trial
                                ? t("today.trial")
                                : t("today.visit", { count: person.visit_number })}
                            </span>
                          </span>
                          {person.note ? (
                            <span className="flex gap-1.5 text-xs text-warning">
                              <NotebookPenIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                              <span>
                                {person.note}{" "}
                                <span className="text-muted-foreground">
                                  · {t("today.noteVisible")}
                                </span>
                              </span>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("today.desk")}>
            {shifts.length === 0 && gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.deskEmpty")}</p>
            ) : null}
            <ul className="grid gap-2">
              {[
                ...shifts.map((shift) => ({ kind: "shift" as const, at: shift.starts_at, shift })),
                ...gaps.map((gap) => ({ kind: "gap" as const, at: gap.start.toISOString(), gap })),
              ]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((entry) =>
                  entry.kind === "shift" ? (
                    <li
                      key={entry.shift.id}
                      className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                    >
                      <span className="w-28 shrink-0 font-medium tabular-nums">
                        {clock(entry.shift.starts_at)} – {clock(entry.shift.ends_at)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {[entry.shift.profiles?.first_name, entry.shift.profiles?.last_name]
                          .filter(Boolean)
                          .join(" ")}
                        {entry.shift.note ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {entry.shift.note}
                          </span>
                        ) : null}
                      </span>
                      {manager ? (
                        <DeskShiftDialog
                          team={team}
                          draft={{
                            id: entry.shift.id,
                            profileId: entry.shift.profile_id,
                            ...draftFor(
                              new Date(entry.shift.starts_at),
                              new Date(entry.shift.ends_at),
                            ),
                            note: entry.shift.note ?? undefined,
                          }}
                          trigger={
                            <Button size="sm" variant="ghost">
                              {t("today.edit")}
                            </Button>
                          }
                        />
                      ) : null}
                    </li>
                  ) : (
                    <li
                      key={entry.at}
                      className="flex items-center gap-3 rounded-lg bg-warning/10 px-3 py-2 text-sm ring-1 ring-warning/25"
                    >
                      <span className="w-28 shrink-0 font-medium tabular-nums">
                        {clock(entry.gap.start)} – {clock(entry.gap.end)}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-warning">
                        {t("today.deskGap")}
                      </span>
                      {manager ? (
                        <DeskShiftDialog
                          team={team}
                          draft={draftFor(entry.gap.start, entry.gap.end)}
                          trigger={<Button size="sm">{t("today.assign")}</Button>}
                        />
                      ) : null}
                    </li>
                  ),
                )}
            </ul>
            {manager ? (
              <div className="flex flex-wrap items-center gap-3">
                <DeskShiftDialog
                  team={team}
                  draft={{
                    date: today,
                    start: config.private.desk_default_start,
                    end: config.private.desk_default_end,
                  }}
                  trigger={
                    <Button size="sm" variant="outline">
                      <PlusIcon data-icon="inline-start" />
                      {t("today.addShift")}
                    </Button>
                  }
                />
                <Link href="/planning" className="text-sm font-medium text-primary hover:underline">
                  {t("today.manageShifts")}
                </Link>
              </div>
            ) : null}
          </Panel>
        </div>
        {list}
      </section>
    ),
    clients: frontDesk ? (
      <section key="clients" aria-labelledby="clients" className="grid gap-4">
        <SectionTitle
          id="clients"
          href={manager ? "/crm" : "/adherents"}
          link={t(manager ? "today.pipeline" : "nav.members")}
        >
          {t("today.clients")}
        </SectionTitle>
        <div className={cn("grid items-start gap-4", manager && "lg:grid-cols-2")}>
          <Panel title={t("today.newcomers")}>
            {newcomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.newcomersEmpty")}</p>
            ) : (
              <ul className="grid gap-1">
                {newcomers.map((person) => (
                  <li key={person.member_id}>
                    <Link
                      href={`/adherents/${person.member_id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                        {person.first_name.charAt(0)}
                        {person.last_name.charAt(0)}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-medium">
                          {person.first_name} {person.last_name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {person.discipline} {clock(person.starts_at)}
                          {person.is_trial ? ` · ${t("today.trial")}` : ""}
                        </span>
                      </span>
                      <StatusPill tone="neutral" dot={false}>
                        {t("today.visit", { count: person.visit_number })}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {manager ? (
            <Panel title={t("today.crm.title")}>
              <ul className="grid gap-1">
                {todo.map((row) => {
                  const meta = CRM_LINKS[row.kind as keyof typeof CRM_LINKS];
                  if (!meta) return null;
                  return (
                    <li key={row.kind} className="flex items-center gap-3 py-1.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold tabular-nums">
                        {row.total}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="font-medium">{t(meta.label)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t(meta.hint)}
                        </span>
                      </span>
                      {row.total > 0 ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/adherents?a_faire=${row.kind}`}>{t(meta.cta)}</Link>
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}
        </div>
      </section>
    ) : null,
    finance: manager ? (
      <section key="finance" aria-labelledby="finance" className="grid gap-4">
        <SectionTitle
          id="finance"
          href="/parametres?onglet=integrations"
          link={t("today.financeSources")}
        >
          {t("today.finance")}
        </SectionTitle>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel
            title={t("today.unpaid")}
            aside={
              unpaid.length ? (
                <span className="font-semibold text-destructive tabular-nums">
                  {money.format(unpaidTotal / 100)}
                </span>
              ) : null
            }
          >
            {unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.unpaidEmpty")}</p>
            ) : (
              <ul
                className="-mr-2 grid max-h-96 gap-1 overflow-y-auto overscroll-contain pr-2"
                tabIndex={0}
                aria-label={t("today.unpaid")}
              >
                {unpaid.map((row) => (
                  <li key={row.member_id} className="flex items-center gap-3 py-1.5">
                    <span className="grid min-w-0 flex-1">
                      <Link
                        href={`/adherents/${row.member_id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {row.first_name} {row.last_name}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {[
                          row.plan,
                          t("today.failures", { count: row.failures }),
                          t("today.since", { date: format.dateTime(row.first_failed_at) }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {money.format(row.amount_cents / 100)}
                    </span>
                    {configured ? (
                      <AssistantButton
                        size="sm"
                        variant="outline"
                        prompt={t("today.unpaidPrompt", {
                          name: `${row.first_name} ${row.last_name}`,
                          id: row.member_id,
                          amount: money.format(row.amount_cents / 100),
                          count: row.failures,
                        })}
                      >
                        {t("today.remind")}
                      </AssistantButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("today.bills")}>
            <Empty className="rounded-lg border border-dashed p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalculatorIcon />
                </EmptyMedia>
                <EmptyTitle>{t("today.billsPending")}</EmptyTitle>
                <EmptyDescription>{t("today.billsHint")}</EmptyDescription>
              </EmptyHeader>
              <Button asChild size="sm" variant="outline">
                <Link href="/parametres?onglet=integrations">{t("today.connect")}</Link>
              </Button>
            </Empty>
          </Panel>
        </div>
      </section>
    ) : null,
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("today.greeting", {
          name: firstName,
          actions: t("today.actions", { count: actions }),
        })}
        description={format.longDay(now)}
        actions={
          <Button asChild variant="outline">
            <Link href="/planning">{t("today.openPlanning")}</Link>
          </Button>
        }
      />

      {homeBlocksFor(context.role, config.private).map((block) => blocks[block])}
    </div>
  );
}

function SectionTitle({
  id,
  href,
  link,
  children,
}: {
  id: string;
  href: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {children}
      </h2>
      <Link href={href} className="text-sm font-medium text-primary hover:underline">
        {link}
      </Link>
    </div>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-xl bg-card p-4 shadow-border">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
