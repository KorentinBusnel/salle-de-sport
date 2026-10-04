import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { t } from "@/lib/i18n";

/** Le calendrier du téléphone n'existe pas sur le web. */
export const calendarAvailable = Platform.OS !== "web";

/** Ajoute la séance au calendrier par défaut du téléphone ; renvoie le message à afficher. */
export async function addSessionToCalendar(event: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  timeZone: string;
}): Promise<{ ok: boolean; message: string }> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") return { ok: false, message: t("session.calendarDenied") };

  let calendarId: string | undefined;
  if (Platform.OS === "ios") {
    calendarId = (await Calendar.getDefaultCalendarAsync()).id;
  } else {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    calendarId = (
      calendars.find((c) => c.isPrimary && c.allowsModifications) ??
      calendars.find((c) => c.allowsModifications)
    )?.id;
  }
  if (!calendarId) return { ok: false, message: t("session.calendarUnavailable") };

  await Calendar.createEventAsync(calendarId, {
    title: event.title,
    startDate: new Date(event.startsAt),
    endDate: new Date(event.endsAt),
    location: event.location,
    timeZone: event.timeZone,
  });
  return { ok: true, message: t("session.addedToCalendar") };
}
