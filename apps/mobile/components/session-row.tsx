import { Text, View } from "react-native";
import { colors } from "@salle/ui";
import { t } from "@/lib/i18n";
import type { PlanningSession } from "@/lib/planning";

export function SessionRow({ session, timeZone }: { session: PlanningSession; timeZone: string }) {
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const startsAt = new Date(session.starts_at);
  const minutes = Math.round((new Date(session.ends_at).getTime() - startsAt.getTime()) / 60_000);

  return (
    <View className="mx-4 flex-row items-center gap-4 border-b border-neutral-100 bg-neutral-0 px-4 py-3">
      <View className="w-14">
        <Text className="text-base font-semibold text-neutral-900">{time.format(startsAt)}</Text>
        <Text className="text-xs text-neutral-500">{t("planning.duration", { minutes })}</Text>
      </View>
      <View
        className="h-10 w-1 rounded-full"
        style={{ backgroundColor: session.disciplines?.color ?? colors.neutral[300] }}
      />
      <View className="flex-1">
        <Text className="text-base font-medium text-neutral-900">{session.disciplines?.name}</Text>
        <Text className="text-sm text-neutral-500">{session.coaches?.display_name}</Text>
      </View>
      <Text className="text-sm text-neutral-500">
        {t("planning.capacity", { capacity: session.capacity })}
      </Text>
    </View>
  );
}
