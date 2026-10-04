import Ionicons from "@expo/vector-icons/Ionicons";
import { MEMBER_STATUS_TONE } from "@salle/shared";
import { semantic } from "@salle/ui";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, ErrorState, Loading, Notice, StatusPill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex-1 gap-1 px-4 py-3.5">
      <Text className="text-2xl font-semibold text-foreground tabular-nums">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Card>
  );
}

export default function AccountScreen() {
  const { state, refresh } = useMember();
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ready")
    return <ErrorState message={t("common.unexpectedError")} onRetry={refresh} />;

  const { member, gym, credits, hasSubscription, bookings } = state;
  const attended = bookings.filter((b) => b.status === "attended").length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const initials = `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();

  return (
    <ScrollView contentContainerClassName="gap-4 px-4 py-5">
      <Card className="flex-row items-center gap-4 px-4 py-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Text className="text-lg font-semibold text-accent-foreground">{initials}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-lg font-semibold text-foreground">
            {member.first_name} {member.last_name}
          </Text>
          <Text className="text-sm text-muted-foreground">{member.email}</Text>
          <View className="flex-row">
            <StatusPill
              tone={MEMBER_STATUS_TONE[member.status]}
              label={t(`account.memberStatus.${member.status}`)}
            />
          </View>
        </View>
      </Card>

      {member.status === "prospect" ? <Notice>{t("account.prospectHint")}</Notice> : null}

      <Card className="gap-1 px-4 py-3.5">
        <Text className="text-xs text-muted-foreground">{t("account.subscription")}</Text>
        <Text className="text-base font-semibold text-foreground">
          {hasSubscription ? t("account.activeSubscription") : t("account.noSubscription")}
        </Text>
        <Text className="text-xs text-muted-foreground">{gym.name}</Text>
      </Card>

      <View className="flex-row gap-3">
        <Stat label={t("account.credits")} value={credits} />
        <Stat label={t("account.attendance")} value={attended} />
        <Stat label={t("account.noShows")} value={noShows} />
      </View>

      <Text className="px-1 text-sm text-muted-foreground">
        {t("account.upcomingLimit", { count: gym.settings.max_upcoming_bookings })}
      </Text>

      <Pressable
        onPress={() => router.push("/messages")}
        accessibilityRole="button"
        className="active:scale-[0.98]"
      >
        <Card className="flex-row items-center gap-3 px-4 py-3.5">
          <Ionicons name="mail-outline" size={20} color={semantic.foreground} />
          <View className="flex-1">
            <Text className="text-base font-medium text-foreground">{t("messages.title")}</Text>
            <Text className="text-xs text-muted-foreground">{t("messages.hint")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={semantic["muted-foreground"]} />
        </Card>
      </Pressable>

      <Button
        label={t("account.signOut")}
        variant="secondary"
        onPress={() => supabase.auth.signOut()}
      />
    </ScrollView>
  );
}
