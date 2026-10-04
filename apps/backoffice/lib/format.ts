/** Formats de date et d'heure dans le fuseau de la salle. */
export function gymFormatters(timeZone: string) {
  const make = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone, ...options });
  const time = make({ hour: "2-digit", minute: "2-digit" });
  const longDay = make({ weekday: "long", day: "numeric", month: "long" });
  const shortDay = make({ weekday: "short", day: "numeric" });
  const dateTime = make({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return {
    time: (date: Date | string) => time.format(new Date(date)),
    longDay: (date: Date | string) => capitalize(longDay.format(new Date(date))),
    /** « lundi 5 octobre », pour une date en milieu de phrase. */
    longDayInline: (date: Date | string) => longDay.format(new Date(date)),
    shortDay: (date: Date | string) => capitalize(shortDay.format(new Date(date))),
    dateTime: (date: Date | string) => dateTime.format(new Date(date)),
  };
}
