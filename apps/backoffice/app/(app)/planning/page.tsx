import {
  sessionPhase,
  zonedDateKey,
  zonedMinutesOfDay,
  zonedStartOfDateKey,
  zonedWeek,
} from "@salle/shared";
import { CalendarPlusIcon, CalendarXIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { PageHeader } from "@/components/page-header";
import { DraggableSession, DroppableDay, WeekDnd } from "@/components/planning/week-dnd";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
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
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { layoutDay } from "@/lib/week-layout";
import { moveSession, previewMove } from "./move-actions";

export const metadata: Metadata = { title: t("planning.title") };

const PX_PER_MINUTE = 1.1;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

type Search = { semaine?: string; jour?: string; vue?: string; mes?: string };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Search & { ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireTeamContext();
  const tz = context.gym.timezone;
  const format = gymFormatters(tz);
  const now = currentTime();
  const todayKey = zonedDateKey(now, tz);
  const isCoach = context.role === "coach";
  const onlyMine = isCoach && params.mes === "1";
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
  const dayKeys = week.days.map((d) => d.key);
  const selectedKey =
    params.jour && dayKeys.includes(params.jour)
      ? params.jour
      : dayKeys.includes(todayKey)
        ? todayKey
        : mondayKey;

  const href = (overrides: Partial<Search>) => {
    const query = new URLSearchParams();
    const merged: Search = {
      semaine: mondayKey,
      ...(params.vue ? { vue: params.vue } : {}),
      ...(params.mes ? { mes: params.mes } : {}),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, value);
    return `/planning?${query.toString()}`;
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), coaches(display_name, profile_id)",
    )
    .eq("gym_id", context.gym.id)
    .gte("starts_at", week.start.toISOString())
    .lt("starts_at", week.end.toISOString())
    .order("starts_at");

  if (error) return <p className="text-destructive">{t("planning.loadError")}</p>;

  const sessions = data
    .filter((s) => !onlyMine || s.coaches?.profile_id === context.userId)
    .map((session) => {
      const startMinute = zonedMinutesOfDay(new Date(session.starts_at), tz);
      const duration = Math.round(
        (Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60_000,
      );
      return {
        ...session,
        startMinute,
        endMinute: startMinute + duration,
        dayKey: zonedDateKey(new Date(session.starts_at), tz),
        full: session.status === "scheduled" && session.booked_count >= session.capacity,
      };
    });
  type PlanningSession = (typeof sessions)[number];

  const disciplines = [
    ...new Map(
      sessions.flatMap((s) =>
        s.disciplines ? [[s.disciplines.name, s.disciplines.color] as const] : [],
      ),
    ),
  ];
  const firstHour = Math.min(7, ...sessions.map((s) => Math.floor(s.startMinute / 60)));
  const lastHour = Math.max(21, ...sessions.map((s) => Math.ceil(s.endMinute / 60)));
  const gridHeight = (lastHour - firstHour) * 60 * PX_PER_MINUTE;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const nowMinute = zonedMinutesOfDay(now, tz);
  const nowTop =
    nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60
      ? (nowMinute - firstHour * 60) * PX_PER_MINUTE
      : null;

  const ariaLabel = (s: PlanningSession) =>
    [
      `${s.disciplines?.name ?? ""} ${format.time(s.starts_at)}–${format.time(s.ends_at)}`,
      s.coaches?.display_name,
      s.status === "cancelled"
        ? t("planning.cancelled")
        : t("planning.placesLong", { booked: s.booked_count, capacity: s.capacity }),
      s.full ? t("planning.full") : null,
      s.waitlist_count > 0 ? t("planning.waitlistLong", { count: s.waitlist_count }) : null,
    ]
      .filter(Boolean)
      .join(", ");

  const empty =
    sessions.length === 0 ? (
      <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarXIcon />
          </EmptyMedia>
          <EmptyTitle>{t("planning.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {isManagerRole(context.role) ? t("planning.emptyManager") : t("planning.emptyTeam")}
          </EmptyDescription>
        </EmptyHeader>
        {isManagerRole(context.role) ? (
          <EmptyContent>
            <Button asChild>
              <Link href="/planning/modeles">
                <CalendarPlusIcon data-icon="inline-start" />
                {t("planning.goToTemplates")}
              </Link>
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    ) : null;

  const daySessions = sessions.filter((s) => s.dayKey === selectedKey);
  // Glisser-déposer : gérant, séances à venir non annulées.
  const canMove = isManagerRole(context.role);

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        title={t("planning.weekOf", { date: format.longDayInline(week.start) })}
        actions={
          <>
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
                <Link href={href({ vue: "jour", jour: selectedKey })}>{t("planning.dayView")}</Link>
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
                  <ChevronLeftIcon />
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
                  <ChevronRightIcon />
                </Link>
              </Button>
            </ButtonGroup>
          </>
        }
      />

      <Flash ok={params.ok} error={params.erreur} />

      {disciplines.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("planning.legend")}>
          {disciplines.map(([name, color]) => (
            <li key={name}>
              <DisciplineChip name={name} color={color} />
            </li>
          ))}
        </ul>
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
                return (
                  <Link
                    key={day.key}
                    href={href({ jour: day.key, ...(view ? {} : {}) })}
                    aria-current={selected ? "date" : undefined}
                    className={cn(
                      "flex min-w-16 shrink-0 flex-col items-center rounded-xl px-3 py-2 text-sm transition-colors pointer-coarse:min-h-14",
                      selected
                        ? "bg-primary text-primary-foreground"
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
                        : t("planning.sessionsCount", { count })}
                    </span>
                  </Link>
                );
              })}
            </nav>
            {daySessions.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("planning.noSessionThatDay")}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl bg-card shadow-border">
                {daySessions.map((s) => {
                  const phase = sessionPhase(new Date(s.starts_at), new Date(s.ends_at), now);
                  return (
                    <li key={s.id} className="border-t border-border/70 first:border-t-0">
                      <Link
                        href={`/planning/${s.id}`}
                        aria-label={ariaLabel(s)}
                        className={cn(
                          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03]",
                          (phase === "past" || s.status === "cancelled") && "text-muted-foreground",
                        )}
                      >
                        <span className="w-14 text-sm tabular-nums">
                          <span className="block font-medium text-foreground">
                            {format.time(s.starts_at)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format.time(s.ends_at)}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <DisciplineChip
                            name={s.disciplines?.name ?? ""}
                            color={s.disciplines?.color}
                          />
                          <span className="truncate text-sm text-muted-foreground">
                            {s.coaches?.display_name}
                          </span>
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
                  );
                })}
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
            {canMove ? (
              <p className="mb-2 text-xs text-muted-foreground">{t("planning.dragHint")}</p>
            ) : null}
            <WeekDnd
              enabled={canMove}
              pxPerMinute={PX_PER_MINUTE}
              timeZone={tz}
              actions={{ preview: previewMove, move: moveSession }}
            >
              <div className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl bg-card shadow-border">
                <div className="grid min-w-[56rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                  <div className="sticky top-0 left-0 z-30 border-b bg-card" />
                  {week.days.map((day) => {
                    const isToday = day.key === todayKey;
                    return (
                      <div
                        key={day.key}
                        aria-current={isToday ? "date" : undefined}
                        className="sticky top-0 z-20 border-b border-l bg-card px-2 py-2 text-center text-sm font-medium"
                      >
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {format.shortDay(day.start)}
                        </span>
                      </div>
                    );
                  })}

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
                    const placed = layoutDay(sessions.filter((s) => s.dayKey === day.key));
                    return (
                      <DroppableDay
                        key={day.key}
                        dayKey={day.key}
                        className={cn("relative border-l", isToday && "bg-accent/40")}
                        style={{ height: gridHeight }}
                      >
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
                          const movable =
                            !cancelled && Date.parse(session.starts_at) > now.getTime();
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
                                aria-label={ariaLabel(session)}
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
                                  <span className="tabular-nums">
                                    {format.time(session.starts_at)}
                                  </span>{" "}
                                  {session.disciplines?.name}
                                </span>
                                <span className="block truncate text-foreground/70">
                                  {cancelled
                                    ? t("planning.cancelled")
                                    : session.coaches?.display_name}
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
  );
}
