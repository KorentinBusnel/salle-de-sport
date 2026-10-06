import { coachesLabel } from "@salle/shared";
import {
  CalendarXIcon,
  ClipboardCheckIcon,
  GaugeIcon,
  HourglassIcon,
  NotebookPenIcon,
  PlusIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { DeskShiftProvider, DeskShiftTrigger } from "@/components/desk/desk-shift-dialog";
import { KpiCard } from "@/components/kpi-card";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { CareNotePopover } from "@/components/today/care-note-popover";
import { HomeCard, HomeSection } from "@/components/today/home-section";
import { ShowMore } from "@/components/today/show-more";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { TeamContext } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getTeamOptions } from "@/lib/team";
import { getTodayDesk, getTodayFrame, getTodaySessions, getTodayTrials } from "@/lib/today";
import { cn } from "@/lib/utils";

/**
 * Opérations du jour : indicateurs, essais et nouveaux venus, permanence à l'accueil, séances.
 * Chaque rôle ne voit que ce que la RLS lui ouvre (un coach : ses séances).
 */
export async function OperationsSection({ context }: { context: TeamContext }) {
  const frame = getTodayFrame(context);
  const [day, trials, desk, team] = await Promise.all([
    getTodaySessions(context),
    getTodayTrials(context),
    getTodayDesk(context),
    frame.manager ? getTeamOptions(context) : [],
  ]);
  const format = gymFormatters(frame.tz);
  const clock = (date: Date | string) => format.time(date);
  const draftFor = (from: Date, to: Date) => ({
    date: frame.today,
    start: clock(from).replace(" h ", ":"),
    end: clock(to).replace(" h ", ":"),
  });

  const deskEntries = [
    ...desk.shifts.map((shift) => ({ kind: "shift" as const, at: shift.starts_at, shift })),
    ...desk.gaps.map((gap) => ({ kind: "gap" as const, at: gap.start.toISOString(), gap })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <HomeSection
      id="operations"
      title={t("today.operations")}
      href="/planning"
      link={t("today.dayPlanning")}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label={t("today.fill")}
          icon={GaugeIcon}
          href="/planning"
          value={day.capacity ? Math.round((day.booked / day.capacity) * 100) : "—"}
          suffix={day.capacity ? "%" : undefined}
          hint={t("dashboard.seats", { booked: day.booked, capacity: day.capacity })}
        />
        <KpiCard
          label={t("dashboard.toCheck")}
          icon={ClipboardCheckIcon}
          value={day.toCheck}
          hint={t("dashboard.toCheckHint")}
        />
        <KpiCard
          label={t("dashboard.waitlistTotal")}
          icon={HourglassIcon}
          value={day.waitlist}
          hint={t("dashboard.waitlistHint")}
        />
        <KpiCard
          label={t("today.newcomersKpi")}
          icon={UserPlusIcon}
          value={trials.newcomers.length}
          hint={t("today.newcomersKpiHint")}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <HomeCard
          title={t("today.trials")}
          aside={
            trials.newcomers.length ? (
              <StatusPill tone="warning">
                {t("today.trialsCount", { count: trials.newcomers.length })}
              </StatusPill>
            ) : null
          }
        >
          {trials.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("today.trialsEmpty")}</p>
          ) : (
            <ShowMore
              label={t("today.trials")}
              initial={3}
              className="grid gap-2"
              items={trials.sessions.map((session) => (
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
                    {session.people.map((person) => {
                      const name = `${person.first_name} ${person.last_name}`;
                      return (
                        <li key={person.member_id} className="flex items-start gap-2">
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/adherents/${person.member_id}`}
                                className="font-medium hover:underline"
                              >
                                {name}
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
                          </span>
                          {frame.frontDesk ? (
                            <CareNotePopover
                              memberId={person.member_id}
                              name={name}
                              note={person.note ?? ""}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            />
          )}
        </HomeCard>

        <DeskShiftProvider team={team}>
          <HomeCard title={t("today.desk")}>
            {deskEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.deskEmpty")}</p>
            ) : (
              <ul className="grid gap-2">
                {deskEntries.map((entry) =>
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
                      {frame.manager ? (
                        <DeskShiftTrigger
                          draft={{
                            id: entry.shift.id,
                            profileId: entry.shift.profile_id,
                            ...draftFor(
                              new Date(entry.shift.starts_at),
                              new Date(entry.shift.ends_at),
                            ),
                            note: entry.shift.note ?? undefined,
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          {t("today.edit")}
                        </DeskShiftTrigger>
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
                      {frame.manager ? (
                        <DeskShiftTrigger
                          draft={draftFor(entry.gap.start, entry.gap.end)}
                          size="sm"
                        >
                          {t("today.assign")}
                        </DeskShiftTrigger>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            )}
            {frame.manager ? (
              <div className="flex flex-wrap items-center gap-3">
                <DeskShiftTrigger
                  draft={{ date: frame.today, ...desk.defaultSlot }}
                  size="sm"
                  variant="outline"
                >
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  {t("today.addShift")}
                </DeskShiftTrigger>
                <Link href="/planning" className="text-sm font-medium text-primary hover:underline">
                  {t("today.manageShifts")}
                </Link>
              </div>
            ) : null}
          </HomeCard>
        </DeskShiftProvider>
      </div>

      <SessionList sessions={day.sessions} clock={clock} />
    </HomeSection>
  );
}

type DaySessions = Awaited<ReturnType<typeof getTodaySessions>>["sessions"];

function SessionList({
  sessions,
  clock,
}: {
  sessions: DaySessions;
  clock: (date: Date | string) => string;
}) {
  return (
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
              <CalendarXIcon aria-hidden />
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
                    {clock(session.starts_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">{clock(session.ends_at)}</span>
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
                  {session.lowFill ? (
                    <StatusPill tone="brand" dot={false}>
                      {t("today.lowFill")}
                    </StatusPill>
                  ) : null}
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
                      className={
                        session.phase === "live"
                          ? "[&>span]:animate-[pulse_2s_ease-in-out_3] motion-reduce:[&>span]:animate-none"
                          : undefined
                      }
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
}
