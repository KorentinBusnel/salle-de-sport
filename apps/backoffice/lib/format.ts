import { formatMoney } from "@salle/shared";
/** Formats de date et d'heure dans le fuseau de la salle. */
export function gymFormatters(timeZone: string) {
  const make = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone, ...options });
  const time = make({ hour: "2-digit", minute: "2-digit" });
  const longDay = make({ weekday: "long", day: "numeric", month: "long" });
  const shortDay = make({ weekday: "short", day: "numeric" });
  const dateTime = make({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const civil = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const civilDay = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return {
    time: (date: Date | string) => time.format(new Date(date)),
    longDay: (date: Date | string) => capitalize(longDay.format(new Date(date))),
    /** « lundi 5 octobre », pour une date en milieu de phrase. */
    longDayInline: (date: Date | string) => longDay.format(new Date(date)),
    shortDay: (date: Date | string) => capitalize(shortDay.format(new Date(date))),
    dateTime: (date: Date | string) => dateTime.format(new Date(date)),
    /** Date civile « AAAA-MM-JJ » (sans heure) : « 5 oct. 2026 ». */
    dateKey: (key: string) => civil.format(new Date(`${key}T12:00:00Z`)),
    /** Date civile « AAAA-MM-JJ » en toutes lettres : « lundi 12 octobre ». */
    dayKey: (key: string) => civilDay.format(new Date(`${key}T12:00:00Z`)),
  };
}

/** Initiales d'un nom (« Nadia Lambert » → « NL »), pour les avatars. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Montant en centimes → « 1 234,50 € » (formatMoney de packages/shared). */
export function euros(cents: number): string {
  return formatMoney(cents);
}

/** Durée en minutes → « 12 h 30 » (ou « 45 min »). */
export function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
