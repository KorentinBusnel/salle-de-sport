import { spotsLeft, zonedDayRange } from "@salle/shared";
import { t } from "@/lib/i18n";

export type PlanningDay = { key: string; start: Date; end: Date; label: string };

/** Les `count` prochains jours locaux de la salle, avec « Aujourd'hui » et « Demain ». */
export function planningDays(now: Date, timeZone: string, count = 7): PlanningDay[] {
  const format = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "short", day: "numeric" });
  const days: PlanningDay[] = [];
  let { start, end } = zonedDayRange(now, timeZone);
  for (let index = 0; index < count; index++) {
    const raw = format.format(start);
    const label =
      index === 0
        ? t("planning.today")
        : index === 1
          ? t("planning.tomorrow")
          : raw.charAt(0).toUpperCase() + raw.slice(1);
    days.push({ key: start.toISOString(), start, end, label });
    // Le lendemain : la journée qui contient « fin + 1 h » (journées de 23 h ou 25 h comprises).
    ({ start, end } = zonedDayRange(new Date(end.getTime() + 3_600_000), timeZone));
  }
  return days;
}

/** Libellé des places d'une séance. */
export function spotsText(
  capacity: number,
  booked: number,
  waitlist: number,
): { text: string; full: boolean } {
  const left = spotsLeft(capacity, booked);
  if (left === 0) {
    return {
      full: true,
      text: waitlist > 0 ? t("planning.fullWithWaitlist", { count: waitlist }) : t("planning.full"),
    };
  }
  return {
    full: false,
    text: left === 1 ? t("planning.oneSpotLeft") : t("planning.spotsLeft", { count: left }),
  };
}
