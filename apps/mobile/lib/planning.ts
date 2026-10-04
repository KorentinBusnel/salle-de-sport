import { zonedDayRange } from "@salle/shared";
import { t } from "@/lib/i18n";

export type PlanningSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  disciplines: { name: string; color: string } | null;
  coaches: { display_name: string } | null;
};

export type PlanningDay = { key: string; title: string; data: PlanningSession[] };

/**
 * Regroupe les séances par jour local de la salle, dans l'ordre chronologique,
 * avec « Aujourd'hui » et « Demain » pour les deux premiers jours.
 */
export function groupSessionsByDay(
  sessions: readonly PlanningSession[],
  timeZone: string,
  now: Date,
): PlanningDay[] {
  const today = zonedDayRange(now, timeZone).start.getTime();
  const tomorrow = zonedDayRange(new Date(today + 36 * 3_600_000), timeZone).start.getTime();
  const dayFormat = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const days = new Map<number, PlanningDay>();
  const sorted = [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const session of sorted) {
    const startsAt = new Date(session.starts_at);
    const dayStart = zonedDayRange(startsAt, timeZone).start.getTime();
    let day = days.get(dayStart);
    if (!day) {
      const label = dayFormat.format(startsAt);
      const title =
        dayStart === today
          ? t("planning.today")
          : dayStart === tomorrow
            ? t("planning.tomorrow")
            : label.charAt(0).toUpperCase() + label.slice(1);
      day = { key: new Date(dayStart).toISOString(), title, data: [] };
      days.set(dayStart, day);
    }
    day.data.push(session);
  }
  return [...days.values()];
}
