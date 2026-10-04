/**
 * Dates dans le fuseau de la salle (gyms.timezone), sans dépendance :
 * utilisable par le back office, le mobile et les Edge Functions (Deno).
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClockParts(instant: Date, timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(instant)) {
    if (type !== "literal") parts[type] = Number(value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et l'UTC à cet instant. */
function timeZoneOffset(instant: Date, timeZone: string): number {
  const p = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à minuit (heure locale) du jour donné dans le fuseau. */
function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - timeZoneOffset(new Date(guess), timeZone);
  // Second passage : corrige le cas où le décalage change entre guess et minuit local.
  return new Date(guess - timeZoneOffset(new Date(first), timeZone));
}

/**
 * Bornes [début, fin) de la journée locale contenant `instant`, dans le fuseau donné.
 * Gère les changements d'heure (journées de 23 h ou 25 h).
 */
export function zonedDayRange(instant: Date, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = wallClockParts(instant, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: localMidnight(year, month, day, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  };
}

/** Date locale « AAAA-MM-JJ » de l'instant dans le fuseau donné. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  const { year, month, day } = wallClockParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Minutes écoulées depuis minuit (heure locale du fuseau). */
export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const { hour, minute } = wallClockParts(instant, timeZone);
  return hour * 60 + minute;
}

/** Instant correspondant à minuit local d'une date « AAAA-MM-JJ » dans le fuseau donné. */
export function zonedStartOfDateKey(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return localMidnight(year ?? 1970, month ?? 1, day ?? 1, timeZone);
}

/**
 * Semaine locale (lundi → lundi suivant) contenant l'instant, avec ses 7 jours.
 * Gère les semaines de changement d'heure (167 h ou 169 h).
 */
export function zonedWeek(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date; days: { key: string; start: Date; end: Date }[] } {
  const { year, month, day } = wallClockParts(instant, timeZone);
  // Jour ISO de la semaine (1 = lundi) calculé sur la date civile, indépendante du fuseau.
  const isoWeekday = ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
  const days = Array.from({ length: 7 }, (_, index) => {
    const civil = new Date(Date.UTC(year, month - 1, day - (isoWeekday - 1) + index));
    const key = civil.toISOString().slice(0, 10);
    const next = new Date(civil.getTime() + 86_400_000).toISOString().slice(0, 10);
    return {
      key,
      start: zonedStartOfDateKey(key, timeZone),
      end: zonedStartOfDateKey(next, timeZone),
    };
  });
  const first = days[0];
  const last = days[6];
  if (!first || !last) throw new Error("semaine invalide");
  return { start: first.start, end: last.end, days };
}
