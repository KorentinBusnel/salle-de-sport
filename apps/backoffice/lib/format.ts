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
  return {
    time: (date: Date | string) => time.format(new Date(date)),
    longDay: (date: Date | string) => capitalize(longDay.format(new Date(date))),
    /** « lundi 5 octobre », pour une date en milieu de phrase. */
    longDayInline: (date: Date | string) => longDay.format(new Date(date)),
    shortDay: (date: Date | string) => capitalize(shortDay.format(new Date(date))),
    dateTime: (date: Date | string) => dateTime.format(new Date(date)),
    /** Date civile « AAAA-MM-JJ » (sans heure) : « 5 oct. 2026 ». */
    dateKey: (key: string) => civil.format(new Date(`${key}T12:00:00Z`)),
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
