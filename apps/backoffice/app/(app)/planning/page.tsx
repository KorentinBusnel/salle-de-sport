import {
  clockToMinutes,
  coachesLabel,
  deskWindows,
  hasOpeningHours,
  isLowFill,
  openingIntervals,
  openingSpan,
  sessionPhase,
  shiftDateKey,
  uncoveredIntervals,
  weekdayOfDateKey,
  zonedDateKey,
  zonedMinutesOfDay,
  zonedStartOfDateKey,
  zonedWeek,
} from "@salle/shared";
import {
  CalendarPlusIcon,
  CalendarXIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeskDay } from "@/components/desk/desk-day";
import { DeskShiftProvider } from "@/components/desk/desk-shift-dialog";
import { Flash } from "@/components/flash";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { PageHeader } from "@/components/page-header";
import { type CreateOptions, QuickCreateDialog } from "@/components/planning/quick-create";
import type { SessionSummary } from "@/components/planning/session-sheet";
import { DraggableSession, DroppableDay, WeekDnd } from "@/components/planning/week-dnd";
import { WeekPicker } from "@/components/planning/week-picker";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { isManagerRole, requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { getTeamOptions } from "@/lib/team";
import { cn } from "@/lib/utils";
import { DND_INSTRUCTIONS_ID, layoutDay } from "@/lib/week-layout";

export const metadata: Metadata = { title: t("planning.title") };

const PX_PER_MINUTE = 1.1;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Search = { semaine?: string; jour?: string; vue?: string; mes?: string; d?: string };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Search & { ok?: string; erreur?: string; creer?: string }>;
}) {
  const params = await searchParams;
  const context = await requireTeamContext();
  const tz = context.gym.timezone;
  const format = gymFormatters(tz);
  const now = currentTime();
  const todayKey = zonedDateKey(now, tz);
  const isCoach = context.role === "coach";
  const manager = isManagerRole(context.role);
  const onlyMine = isCoach && params.mes === "1";
  // Légende cliquable : disciplines affichées (toutes si aucune n'est choisie).
  const shown = (params.d ?? "").split(",").filter((id) => GUID.test(id));
  // Sans choix explicite : semaine sur grand écran, jour sur tablette et mobile.
  const view = params.vue === "jour" || params.vue === "semaine" ? params.vue : null;

  const anchorKey =
    params.jour && DATE_KEY.test(params.jour)
      ? params.jour
      : params.semaine && DATE_KEY.test(params.semaine)
        ? params.semaine
        : todayKey;
  const week = zonedWeek(
    new Date(zonedStartOfDateKey(anchorKey, tz).getTime() + 12 * 3_600_000),
    tz,
  );
  const mondayKey = week.days[0]?.key ?? anchorKey;
  const sundayKey = week.days.at(-1)?.key ?? mondayKey;
  const dayKeys = week.days.map((d) => d.key);
  const selectedKey =
    params.jour && dayKeys.includes(params.jour)
      ? params.jour
      : dayKeys.includes(todayKey)
        ? todayKey
        : mondayKey;

  const query = (overrides: Partial<Search>) => {
    const search = new URLSearchParams();
    const merged: Search = {
      semaine: mondayKey,
      ...(params.vue ? { vue: params.vue } : {}),
      ...(params.mes ? { mes: params.mes } : {}),
      ...(shown.length ? { d: shown.join(",") } : {}),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    return search.toString();
  };
  const href = (overrides: Partial<Search>) => `/planning?${query(overrides)}`;

  const supabase = await createClient();
  const [sessionsResult, shiftsResult, team, config, closuresResult, createOptions] =
    await Promise.all([
      supabase
        .from("class_sessions")
        .select(
          "id, template_id, discipline_id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), rooms(name), session_coaches(position, coaches(display_name, profile_id))",
        )
        .eq("gym_id", context.gym.id)
        .gte("starts_at", week.start.toISOString())
        .lt("starts_at", week.end.toISOString())
        .order("starts_at"),
      // Permanences à l'accueil de la semaine (toute l'équipe les voit, le gérant les planifie).
      supabase
        .from("desk_shifts")
        .select(
          "id, profile_id, starts_at, ends_at, note, profiles!desk_shifts_profile_id_fkey(first_name, last_name)",
        )
        .eq("gym_id", context.gym.id)
        .lt("starts_at", week.end.toISOString())
        .gt("ends_at", week.start.toISOString())
        .order("starts_at"),
      manager ? getTeamOptions(context) : [],
      getGymConfig(context.gym.id),
      supabase
        .from("gym_closures")
        .select("day, label")
        .eq("gym_id", context.gym.id)
        .gte("day", mondayKey)
        .lte("day", sundayKey),
      manager ? createOptionsFor(context.gym.id) : null,
    ]);

  if (sessionsResult.error) {
    return <p className="text-destructive">{t("planning.loadError")}</p>;
  }
  const data = sessionsResult.data;
  const shiftRows = shiftsResult.data ?? [];
  const closures = closuresResult.data ?? [];
  const clock = (date: Date | string) => format.time(date);

  // Jours fermés : fermeture exceptionnelle, ou aucun horaire ce jour-là (si la salle en a saisi).
  const withHours = hasOpeningHours(config.openingHours);
  const dayInfo = (dayKey: string) => {
    const closure = closures.find((c) => c.day === dayKey) ?? null;
    const open = (config.openingHours[weekdayOfDateKey(dayKey)] ?? []).map((slot) => ({
      start: clockToMinutes(slot.start),
      end: clockToMinutes(slot.end),
    }));
    return { closure, open, closed: closure !== null || (withHours && open.length === 0) };
  };

  const deskFor = (dayKey: string) => {
    const dayShifts = shiftRows.filter(
      (row) => zonedDateKey(new Date(row.starts_at), tz) === dayKey,
    );
    const scheduledThatDay = data.filter(
      (row) => row.status === "scheduled" && zonedDateKey(new Date(row.starts_at), tz) === dayKey,
    );
    return {
      shifts: dayShifts.map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        name: [row.profiles?.first_name, row.profiles?.last_name].filter(Boolean).join(" "),
        start: clock(row.starts_at),
        end: clock(row.ends_at),
        note: row.note,
      })),
      // Présence attendue : horaires d'ouverture du jour, sinon séances ± marge (réglages).
      // Un jour passé n'a plus de trou à couvrir.
      gaps: (dayKey < todayKey
        ? []
        : uncoveredIntervals(
            deskWindows(scheduledThatDay, {
              opening: openingIntervals(config.openingHours, dayKey, tz),
              marginMinutes: config.private.desk_margin_minutes,
            }),
            dayShifts,
            config.private.desk_min_gap_minutes,
          )
      ).map((gap) => ({ start: clock(gap.start), end: clock(gap.end) })),
      defaultSlot: {
        start: config.private.desk_default_start,
        end: config.private.desk_default_end,
      },
    };
  };

  const all = data.map((session) => {
    const coaches = [...session.session_coaches]
      .sort((a, b) => a.position - b.position)
      .flatMap((sc) => (sc.coaches ? [sc.coaches] : []));
    const startMinute = zonedMinutesOfDay(new Date(session.starts_at), tz);
    const duration = Math.round(
      (Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60_000,
    );
    const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), now);
    return {
      ...session,
      coachList: coaches,
      coachLabel: coachesLabel(coaches.map((c) => c.display_name)),
      startMinute,
      endMinute: startMinute + duration,
      dayKey: zonedDateKey(new Date(session.starts_at), tz),
      phase,
      full: session.status === "scheduled" && session.booked_count >= session.capacity,
      lowFill: isLowFill({
        booked: session.booked_count,
        capacity: session.capacity,
        percent: config.private.low_fill_percent,
        phase,
        status: session.status,
      }),
    };
  });
  type PlanningSession = (typeof all)[number];

  const disciplines = [
    ...new Map(
      all.flatMap((s) =>
        s.disciplines
          ? [[s.discipline_id, { name: s.disciplines.name, color: s.disciplines.color }] as const]
          : [],
      ),
    ),
  ].sort((a, b) => a[1].name.localeCompare(b[1].name, "fr"));
  const sessions = all
    .filter((s) => !onlyMine || s.coachList.some((c) => c.profile_id === context.userId))
    .filter((s) => shown.length === 0 || shown.includes(s.discipline_id));

  // Grille : horaires d'ouverture de la semaine (7 h – 21 h sans horaires), étendue aux séances.
  const span = openingSpan(config.openingHours);
  const firstHour = Math.min(
    span ? Math.floor(span.first / 60) : 7,
    ...sessions.map((s) => Math.floor(s.startMinute / 60)),
  );
  const lastHour = Math.max(
    span ? Math.ceil(span.last / 60) : 21,
    ...sessions.map((s) => Math.ceil(s.endMinute / 60)),
  );
  const gridHeight = (lastHour - firstHour) * 60 * PX_PER_MINUTE;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const nowMinute = zonedMinutesOfDay(now, tz);
  const nowTop =
    nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60
      ? (nowMinute - firstHour * 60) * PX_PER_MINUTE
      : null;

  const ariaLabel = (s: PlanningSession) =>
    [
      `${s.disciplines?.name ?? ""} ${clock(s.starts_at)}–${clock(s.ends_at)}`,
      s.coachLabel,
      s.status === "cancelled"
        ? t("planning.cancelled")
        : t("planning.placesLong", { booked: s.booked_count, capacity: s.capacity }),
      s.full ? t("planning.full") : null,
      s.lowFill ? t("today.lowFill") : null,
      s.waitlist_count > 0 ? t("planning.waitlistLong", { count: s.waitlist_count }) : null,
    ]
      .filter(Boolean)
      .join(", ");

  const summaries: SessionSummary[] = sessions.map((s) => ({
    id: s.id,
    discipline: s.disciplines?.name ?? "",
    color: s.disciplines?.color,
    when: `${format.longDay(s.starts_at)} · ${clock(s.starts_at)} – ${clock(s.ends_at)}`,
    coaches: s.coachLabel,
    room: s.rooms?.name ?? null,
    booked: s.booked_count,
    capacity: s.capacity,
    waitlist: s.waitlist_count,
    cancelled: s.status === "cancelled",
    lowFill: s.lowFill,
  }));

  // Gérant : séances maintenues un jour de fermeture (rien n'est bloqué).
  const closedConflicts = manager
    ? week.days.flatMap((day) => {
        const info = dayInfo(day.key);
        const count = all.filter((s) => s.dayKey === day.key && s.status === "scheduled").length;
        return info.closed && count > 0 && day.key >= todayKey
          ? [{ day: day.key, label: info.closure?.label ?? null, count }]
          : [];
      })
    : [];

  const daySessions = sessions.filter((s) => s.dayKey === selectedKey);
  const selectedInfo = dayInfo(selectedKey);
  // Création hors grille : prochaine heure pleine du jour choisi (ou 9 h un autre jour).
  const createMinutes =
    selectedKey === todayKey ? Math.min(23 * 60, (Math.floor(nowMinute / 60) + 1) * 60) : 9 * 60;

  const empty =
    all.length === 0 ? (
      <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarXIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t("planning.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {manager ? t("planning.emptyManager") : t("planning.emptyTeam")}
          </EmptyDescription>
        </EmptyHeader>
        {manager ? (
          <EmptyContent>
            <Button asChild>
              <Link href="/planning/modeles">
                <CalendarPlusIcon data-icon="inline-start" aria-hidden />
                {t("planning.goToTemplates")}
              </Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    ) : null;

  return (
    <DeskShiftProvider team={team}>
      <div className="grid min-w-0 gap-6">
        <PageHeader
          title={t("planning.weekOf", { date: format.longDayInline(week.start) })}
          actions={
            <>
              {manager && createOptions ? (
                <QuickCreateDialog
                  options={createOptions}
                  dayKey={selectedKey < todayKey ? todayKey : selectedKey}
                  minutes={createMinutes}
                  defaultOpen={params.creer === "1"}
                />
              ) : null}
              {isCoach ? (
                <ButtonGroup aria-label={t("planning.filterLabel")}>
                  <Button asChild variant={onlyMine ? "outline" : "secondary"} size="sm">
                    <Link href={href({ mes: "" })} aria-current={!onlyMine ? "true" : undefined}>
                      {t("planning.allClasses")}
                    </Link>
                  </Button>
                  <Button asChild variant={onlyMine ? "secondary" : "outline"} size="sm">
                    <Link href={href({ mes: "1" })} aria-current={onlyMine ? "true" : undefined}>
                      {t("planning.myClasses")}
                    </Link>
                  </Button>
                </ButtonGroup>
              ) : null}
              <ButtonGroup aria-label={t("planning.viewLabel")}>
                <Button asChild variant={view === "jour" ? "secondary" : "outline"} size="sm">
                  <Link href={href({ vue: "jour", jour: selectedKey })}>
                    {t("planning.dayView")}
                  </Link>
                </Button>
                <Button asChild variant={view === "semaine" ? "secondary" : "outline"} size="sm">
                  <Link href={href({ vue: "semaine" })}>{t("planning.weekView")}</Link>
                </Button>
              </ButtonGroup>
              <ButtonGroup aria-label={t("planning.weekNav")}>
                <Button asChild variant="outline" size="icon-sm">
                  <Link
                    href={href({ semaine: shiftDateKey(mondayKey, -7), jour: "" })}
                    aria-label={t("planning.previousWeek")}
                  >
                    <ChevronLeftIcon aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={href({ semaine: "", jour: "" })}
                    aria-current={dayKeys.includes(todayKey) ? "date" : undefined}
                  >
                    {t("planning.thisWeek")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon-sm">
                  <Link
                    href={href({ semaine: shiftDateKey(mondayKey, 7), jour: "" })}
                    aria-label={t("planning.nextWeek")}
                  >
                    <ChevronRightIcon aria-hidden />
                  </Link>
                </Button>
              </ButtonGroup>
              <WeekPicker selected={selectedKey} query={query({ semaine: "", jour: "" })} />
            </>
          }
        />

        <Flash ok={params.ok} error={params.erreur} />

        {closedConflicts.length ? (
          <Alert variant="soft-warning" role="status">
            <CalendarXIcon aria-hidden />
            <AlertTitle>{t("today.closures.title", { count: closedConflicts.length })}</AlertTitle>
            <AlertDescription>
              <ul className="grid gap-0.5">
                {closedConflicts.map((conflict) => (
                  <li key={conflict.day}>
                    <span className="font-medium text-foreground">
                      {format.dayKey(conflict.day)}
                    </span>
                    {conflict.label ? ` (${conflict.label})` : ""}
                    {" : "}
                    <span className="tabular-nums">
                      {t("today.closures.sessions", { count: conflict.count })}
                    </span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {disciplines.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <ul className="flex flex-wrap gap-2" aria-label={t("planning.legendFilter")}>
              {disciplines.map(([id, discipline]) => {
                const active = shown.includes(id);
                const next = active ? shown.filter((d) => d !== id) : [...shown, id];
                return (
                  <li key={id}>
                    <Link
                      href={href({ d: next.join(",") })}
                      scroll={false}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "block rounded-full transition-[opacity,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:py-2",
                        active && "ring-2 ring-foreground/25",
                        shown.length > 0 && !active && "opacity-50 hover:opacity-80",
                      )}
                    >
                      <DisciplineChip name={discipline.name} color={discipline.color} />
                      <span className="sr-only">
                        {active ? t("planning.legendShown") : t("planning.legendShowOnly")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {shown.length ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={href({ d: "" })} scroll={false}>
                  <XIcon data-icon="inline-start" aria-hidden />
                  {t("planning.legendAll")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        {empty ?? (
          <>
            {/* Vue jour : liste lisible sur tablette et mobile. */}
            <section
              className={cn(
                "grid gap-4",
                view === "semaine" ? "hidden" : view === "jour" ? "" : "lg:hidden",
              )}
              aria-label={t("planning.dayView")}
            >
              <nav
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                aria-label={t("planning.days")}
              >
                {week.days.map((day) => {
                  const count = sessions.filter((s) => s.dayKey === day.key).length;
                  const selected = day.key === selectedKey;
                  const closed = dayInfo(day.key).closed;
                  return (
                    <Link
                      key={day.key}
                      href={href({ jour: day.key })}
                      aria-current={selected ? "date" : undefined}
                      className={cn(
                        "flex min-w-16 shrink-0 flex-col items-center rounded-xl px-3 py-2 text-sm transition-colors pointer-coarse:min-h-14",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : closed
                            ? "bg-muted text-muted-foreground hover:bg-muted/70"
                            : "bg-card shadow-border hover:bg-muted",
                      )}
                    >
                      <span className="font-medium">{format.shortDay(day.start)}</span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          selected ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {day.key === todayKey
                          ? t("planning.today")
                          : closed
                            ? t("planning.closed")
                            : t("planning.sessionsCount", { count })}
                      </span>
                    </Link>
                  );
                })}
              </nav>
              {selectedInfo.closed ? (
                <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <CalendarXIcon className="size-4 shrink-0" aria-hidden />
                  {selectedInfo.closure
                    ? t("planning.closedDay", { label: selectedInfo.closure.label })
                    : t("planning.closedWeekly")}
                </p>
              ) : null}
              <div className="grid gap-2 rounded-xl bg-card p-3 shadow-border">
                <h3 className="text-sm font-medium">{t("desk.row")}</h3>
                <DeskDay dayKey={selectedKey} manager={manager} {...deskFor(selectedKey)} />
              </div>
              {daySessions.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("planning.noSessionThatDay")}
                </p>
              ) : (
                <ul className="overflow-hidden rounded-xl bg-card shadow-border">
                  {daySessions.map((s) => (
                    <li key={s.id} className="border-t border-border/70 first:border-t-0">
                      <Link
                        href={`/planning/${s.id}`}
                        aria-label={ariaLabel(s)}
                        className={cn(
                          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03]",
                          (s.phase === "past" || s.status === "cancelled") &&
                            "text-muted-foreground",
                        )}
                      >
                        <span className="w-14 text-sm tabular-nums">
                          <span className="block font-medium text-foreground">
                            {clock(s.starts_at)}
                          </span>
                          <span className="text-xs text-muted-foreground">{clock(s.ends_at)}</span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <DisciplineChip
                            name={s.disciplines?.name ?? ""}
                            color={s.disciplines?.color}
                          />
                          <span className="truncate text-sm text-muted-foreground">
                            {s.coachLabel}
                          </span>
                          {s.lowFill ? (
                            <StatusPill tone="brand" dot={false}>
                              {t("today.lowFill")}
                            </StatusPill>
                          ) : null}
                        </span>
                        {s.status === "cancelled" ? (
                          <StatusPill tone="danger">{t("planning.cancelled")}</StatusPill>
                        ) : (
                          <span className="flex items-center gap-3">
                            {s.full ? (
                              <StatusPill tone="warning">{t("planning.full")}</StatusPill>
                            ) : null}
                            <OccupancyMeter
                              booked={s.booked_count}
                              capacity={s.capacity}
                              label={t("planning.occupancy")}
                              className="w-20"
                            />
                            <span className="text-sm whitespace-nowrap text-foreground tabular-nums">
                              {t("planning.places", {
                                booked: s.booked_count,
                                capacity: s.capacity,
                              })}
                            </span>
                            {s.waitlist_count > 0 ? (
                              <span className="text-xs whitespace-nowrap text-muted-foreground">
                                {t("planning.waitlistLong", { count: s.waitlist_count })}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Vue semaine : grille horaire, en-têtes et heures collants. */}
            <section
              className={cn(
                "min-w-0",
                view === "jour" ? "hidden" : view === "semaine" ? "" : "hidden lg:block",
              )}
              aria-label={t("planning.weekView")}
            >
              <p className="mb-2 text-xs text-muted-foreground">
                {manager ? t("planning.dragHint") : t("planning.previewHint")}
              </p>
              <WeekDnd
                enabled={manager}
                pxPerMinute={PX_PER_MINUTE}
                firstMinute={firstHour * 60}
                timeZone={tz}
                createOptions={createOptions}
                sessions={summaries}
              >
                <div className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl bg-card shadow-border">
                  <div className="grid min-w-[56rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                    <div className="sticky top-0 left-0 z-30 border-b bg-card" />
                    {week.days.map((day) => {
                      const isToday = day.key === todayKey;
                      const info = dayInfo(day.key);
                      return (
                        <div
                          key={day.key}
                          aria-current={isToday ? "date" : undefined}
                          className={cn(
                            "sticky top-0 z-20 grid content-start justify-items-center gap-0.5 border-b border-l px-2 py-2 text-center text-sm font-medium",
                            info.closed ? "bg-muted" : "bg-card",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5",
                              isToday && "bg-primary text-primary-foreground",
                            )}
                          >
                            {format.shortDay(day.start)}
                          </span>
                          {info.closed ? (
                            <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
                              {info.closure?.label || t("planning.closed")}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="sticky left-0 z-10 flex items-start justify-end border-b bg-card px-1.5 py-2 text-xs font-medium text-muted-foreground">
                      {t("desk.row")}
                    </div>
                    {week.days.map((day) => (
                      <div key={`desk-${day.key}`} className="border-b border-l p-1.5">
                        <DeskDay dayKey={day.key} manager={manager} compact {...deskFor(day.key)} />
                      </div>
                    ))}

                    <div className="sticky left-0 z-10 bg-card" style={{ height: gridHeight }}>
                      {hours.map((hour) => (
                        <span
                          key={hour}
                          className="absolute right-2 text-xs text-muted-foreground tabular-nums"
                          style={{ top: (hour - firstHour) * 60 * PX_PER_MINUTE + 2 }}
                        >
                          {`${hour} h`}
                        </span>
                      ))}
                    </div>

                    {week.days.map((day) => {
                      const isToday = day.key === todayKey;
                      const info = dayInfo(day.key);
                      const placed = layoutDay(sessions.filter((s) => s.dayKey === day.key));
                      // Avec des horaires : heures fermées grisées, plages d'ouverture claires.
                      const shaded = info.closed || withHours;
                      return (
                        <DroppableDay
                          key={day.key}
                          dayKey={day.key}
                          className={cn(
                            "relative border-l",
                            info.closed ? "bg-muted/70" : shaded ? "bg-muted/40" : "",
                            !shaded && isToday && "bg-accent/40",
                          )}
                          style={{ height: gridHeight }}
                        >
                          {!info.closed
                            ? info.open.map((slot) => (
                                <div
                                  key={slot.start}
                                  aria-hidden
                                  className={cn(
                                    "absolute inset-x-0",
                                    isToday ? "bg-accent/40" : "bg-card",
                                  )}
                                  style={{
                                    top: (slot.start - firstHour * 60) * PX_PER_MINUTE,
                                    height: (slot.end - slot.start) * PX_PER_MINUTE,
                                  }}
                                />
                              ))
                            : null}
                          {hours.map((hour) => (
                            <div
                              key={hour}
                              className="absolute inset-x-0 border-t border-dashed border-border"
                              style={{ top: (hour - firstHour) * 60 * PX_PER_MINUTE }}
                            />
                          ))}
                          {isToday && nowTop !== null ? (
                            <div
                              aria-hidden
                              className="absolute inset-x-0 z-10 h-0.5 bg-destructive before:absolute before:-top-1 before:-left-1 before:size-2.5 before:rounded-full before:bg-destructive"
                              style={{ top: nowTop }}
                            />
                          ) : null}
                          {placed.map((session) => {
                            const cancelled = session.status === "cancelled";
                            const color = session.disciplines?.color ?? "var(--color-neutral-500)";
                            const movable = manager && !cancelled && session.phase === "upcoming";
                            return (
                              <DraggableSession
                                key={session.id}
                                movable={movable}
                                drag={{
                                  sessionId: session.id,
                                  label: session.disciplines?.name ?? "",
                                  dayKey: session.dayKey,
                                  startMinute: session.startMinute,
                                  duration: session.endMinute - session.startMinute,
                                  recurring: session.template_id !== null,
                                }}
                                className="absolute hover:z-20 focus-within:z-20"
                                style={{
                                  top: (session.startMinute - firstHour * 60) * PX_PER_MINUTE + 1,
                                  height: Math.max(
                                    28,
                                    (session.endMinute - session.startMinute) * PX_PER_MINUTE - 2,
                                  ),
                                  left: `calc(${(session.lane / session.lanes) * 100}% + 2px)`,
                                  width: `calc(${100 / session.lanes}% - 4px)`,
                                }}
                              >
                                <Link
                                  href={`/planning/${session.id}`}
                                  data-session-link={session.id}
                                  aria-label={ariaLabel(session)}
                                  aria-describedby={movable ? DND_INSTRUCTIONS_ID : undefined}
                                  draggable={false}
                                  className={cn(
                                    "block h-full overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-xs leading-tight transition-[box-shadow] hover:shadow-border-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                                    cancelled && "opacity-50",
                                  )}
                                  style={{
                                    borderLeftColor: color,
                                    backgroundColor: `color-mix(in oklab, ${color} 12%, var(--color-card))`,
                                  }}
                                >
                                  <span
                                    className={cn(
                                      "block truncate font-medium",
                                      cancelled && "line-through",
                                    )}
                                  >
                                    <span className="tabular-nums">{clock(session.starts_at)}</span>{" "}
                                    {session.disciplines?.name}
                                  </span>
                                  <span className="block truncate text-foreground/70">
                                    {cancelled ? t("planning.cancelled") : session.coachLabel}
                                  </span>
                                  {!cancelled ? (
                                    <span className="block truncate tabular-nums">
                                      {session.full ? (
                                        <span className="font-semibold text-warning">
                                          {t("planning.full")}
                                        </span>
                                      ) : (
                                        t("planning.places", {
                                          booked: session.booked_count,
                                          capacity: session.capacity,
                                        })
                                      )}
                                      {session.waitlist_count > 0
                                        ? ` · ${t("planning.waitlistShort", { count: session.waitlist_count })}`
                                        : ""}
                                      {session.lowFill ? (
                                        <span className="ml-1 rounded-sm bg-accent px-1 font-medium text-accent-foreground">
                                          {t("today.lowFill")}
                                        </span>
                                      ) : null}
                                    </span>
                                  ) : null}
                                </Link>
                              </DraggableSession>
                            );
                          })}
                        </DroppableDay>
                      );
                    })}
                  </div>
                </div>
              </WeekDnd>
            </section>
          </>
        )}
      </div>
    </DeskShiftProvider>
  );
}

/** Choix de la création rapide (gérant) : disciplines actives, coachs actifs, salles. */
async function createOptionsFor(gymId: string): Promise<CreateOptions> {
  const supabase = await createClient();
  const [disciplines, coaches, rooms] = await Promise.all([
    supabase
      .from("disciplines")
      .select("id, name, color")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("position")
      .order("name"),
    supabase
      .from("coaches")
      .select("id, display_name")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("rooms").select("id, name, capacity").eq("gym_id", gymId).order("name"),
  ]);
  return {
    disciplines: (disciplines.data ?? []).map((d) => ({
      value: d.id,
      label: d.name,
      color: d.color,
    })),
    coaches: (coaches.data ?? []).map((c) => ({
      value: c.id,
      label: c.display_name,
      person: true,
    })),
    rooms: (rooms.data ?? []).map((r) => ({
      value: r.id,
      label: r.name,
      description: t("catalog.placesCount", { count: r.capacity }),
    })),
  };
}
