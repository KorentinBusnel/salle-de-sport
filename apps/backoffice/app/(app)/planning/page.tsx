import { zonedMinutesOfDay, zonedStartOfDateKey, zonedWeek } from "@salle/shared";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { layoutDay } from "@/lib/week-layout";
import { cn } from "@/lib/utils";

const PX_PER_MINUTE = 1.1;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireTeamContext();
  const tz = context.gym.timezone;
  const format = gymFormatters(tz);

  const reference =
    params.semaine && DATE_KEY.test(params.semaine)
      ? new Date(zonedStartOfDateKey(params.semaine, tz).getTime() + 12 * 3_600_000)
      : currentTime();
  const week = zonedWeek(reference, tz);
  const mondayKey = week.days[0]?.key ?? "";

  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("class_sessions")
    .select(
      "id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), coaches(display_name)",
    )
    .eq("gym_id", context.gym.id)
    .gte("starts_at", week.start.toISOString())
    .lt("starts_at", week.end.toISOString())
    .order("starts_at");

  if (error) return <p className="text-destructive">{t("common.unexpectedError")}</p>;

  const timed = sessions.map((session) => ({
    ...session,
    startMinute: zonedMinutesOfDay(new Date(session.starts_at), tz),
    endMinute:
      zonedMinutesOfDay(new Date(session.starts_at), tz) +
      Math.round((Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60_000),
  }));
  const firstHour = Math.min(7, ...timed.map((s) => Math.floor(s.startMinute / 60)));
  const lastHour = Math.max(21, ...timed.map((s) => Math.ceil(s.endMinute / 60)));
  const gridHeight = (lastHour - firstHour) * 60 * PX_PER_MINUTE;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {t("planning.weekOf", { date: format.longDayInline(week.start) })}
        </h1>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/planning?semaine=${shiftDateKey(mondayKey, -7)}`}>
              {t("planning.previousWeek")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/planning">{t("planning.thisWeek")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/planning?semaine=${shiftDateKey(mondayKey, 7)}`}>
              {t("planning.nextWeek")}
            </Link>
          </Button>
        </div>
      </div>

      <Flash ok={params.ok} error={params.erreur} />

      {sessions.length === 0 ? (
        <p className="text-muted-foreground">{t("planning.empty")}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="grid min-w-[56rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="border-b" />
          {week.days.map((day) => (
            <div
              key={day.key}
              className="border-b border-l px-2 py-2 text-center text-sm font-medium"
            >
              {format.shortDay(day.start)}
            </div>
          ))}

          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
                style={{ top: (hour - firstHour) * 60 * PX_PER_MINUTE }}
              >
                {hour > firstHour ? `${hour} h` : ""}
              </span>
            ))}
          </div>

          {week.days.map((day) => {
            const placed = layoutDay(
              timed.filter(
                (s) =>
                  Date.parse(s.starts_at) >= day.start.getTime() &&
                  Date.parse(s.starts_at) < day.end.getTime(),
              ),
            );
            return (
              <div key={day.key} className="relative border-l" style={{ height: gridHeight }}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-dashed border-border"
                    style={{ top: (hour - firstHour) * 60 * PX_PER_MINUTE }}
                  />
                ))}
                {placed.map((session) => {
                  const cancelled = session.status === "cancelled";
                  const full = session.booked_count >= session.capacity;
                  return (
                    <Link
                      key={session.id}
                      href={`/planning/${session.id}`}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-4 bg-card px-1.5 py-1 text-xs shadow-sm ring-1 ring-border transition hover:z-10 hover:shadow-md",
                        cancelled && "opacity-50 line-through",
                      )}
                      style={{
                        top: (session.startMinute - firstHour * 60) * PX_PER_MINUTE,
                        height: Math.max(
                          28,
                          (session.endMinute - session.startMinute) * PX_PER_MINUTE - 2,
                        ),
                        left: `calc(${(session.lane / session.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / session.lanes}% - 4px)`,
                        borderLeftColor: session.disciplines?.color ?? "var(--color-neutral-500)",
                      }}
                    >
                      <span className="block font-medium">
                        {format.time(session.starts_at)} {session.disciplines?.name}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {cancelled ? t("planning.cancelled") : session.coaches?.display_name}
                      </span>
                      {!cancelled ? (
                        <span
                          className={cn(
                            "block tabular-nums",
                            full && "font-semibold text-brand-700",
                          )}
                        >
                          {t("planning.places", {
                            booked: session.booked_count,
                            capacity: session.capacity,
                          })}
                          {session.waitlist_count > 0
                            ? ` ${t("planning.waitlist", { count: session.waitlist_count })}`
                            : ""}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
