import { BOOKING_STATUS_TONE } from "@salle/shared";
import { colors, shadows } from "@salle/ui";
import { Pressable, Text, View } from "react-native";
import { Gauge, StatusPill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { spotsText } from "@/lib/planning";

export type CardSession = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  disciplines: { name: string; color: string } | null;
  coaches: { display_name: string } | null;
};

export function SessionCard({
  session,
  timeZone,
  myStatus,
  onPress,
}: {
  session: CardSession;
  timeZone: string;
  myStatus: { status: string; position: number | null } | undefined;
  onPress: () => void;
}) {
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" });
  const startsAt = new Date(session.starts_at);
  const minutes = Math.round((Date.parse(session.ends_at) - startsAt.getTime()) / 60_000);
  const spots = spotsText(session.capacity, session.booked_count, session.waitlist_count);
  const color = session.disciplines?.color ?? colors.neutral[300];
  const label = [
    time.format(startsAt),
    session.disciplines?.name,
    session.coaches?.display_name,
    spots.text,
    myStatus
      ? myStatus.status === "waitlisted"
        ? t("planning.waitlisted", { position: myStatus.position ?? "?" })
        : t("planning.booked")
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="mx-4 mb-3 overflow-hidden rounded-xl bg-card active:scale-[0.98] active:bg-muted"
      style={{ boxShadow: shadows.border }}
    >
      <View className="flex-row">
        <View className="w-1" style={{ backgroundColor: color }} />
        <View className="flex-1 gap-3 px-4 py-3.5">
          <View className="flex-row items-start gap-4">
            <View className="w-14">
              <Text className="text-lg font-semibold text-foreground tabular-nums">
                {time.format(startsAt)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {t("planning.duration", { minutes })}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-foreground">
                {session.disciplines?.name}
              </Text>
              <Text className="text-sm text-muted-foreground">{session.coaches?.display_name}</Text>
            </View>
            {myStatus ? (
              <StatusPill
                tone={myStatus.status === "waitlisted" ? BOOKING_STATUS_TONE.waitlisted : "brand"}
                label={
                  myStatus.status === "waitlisted"
                    ? t("planning.waitlisted", { position: myStatus.position ?? "?" })
                    : t("planning.booked")
                }
              />
            ) : null}
          </View>
          <View className="flex-row items-center gap-3">
            <Gauge booked={session.booked_count} capacity={session.capacity} className="flex-1" />
            <Text
              className={`text-xs tabular-nums ${spots.full ? "font-semibold text-warning" : "text-muted-foreground"}`}
            >
              {spots.text}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
