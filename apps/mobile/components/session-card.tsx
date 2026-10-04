import { colors } from "@salle/ui";
import { Pressable, Text, View } from "react-native";
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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mx-4 mb-2 flex-row items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-0 px-4 py-3 active:bg-neutral-50"
    >
      <View className="w-14">
        <Text className="text-base font-semibold text-neutral-900">{time.format(startsAt)}</Text>
        <Text className="text-xs text-neutral-500">{t("planning.duration", { minutes })}</Text>
      </View>
      <View
        className="h-10 w-1 rounded-full"
        style={{ backgroundColor: session.disciplines?.color ?? colors.neutral[300] }}
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-neutral-900">{session.disciplines?.name}</Text>
        <Text className="text-sm text-neutral-500">{session.coaches?.display_name}</Text>
      </View>
      <View className="items-end gap-1">
        {myStatus ? (
          <Text className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {myStatus.status === "waitlisted"
              ? t("planning.waitlisted", { position: myStatus.position ?? "?" })
              : t("planning.booked")}
          </Text>
        ) : null}
        <Text
          className={`text-sm ${spots.full ? "font-semibold text-brand-700" : "text-neutral-500"}`}
        >
          {spots.text}
        </Text>
      </View>
    </Pressable>
  );
}
