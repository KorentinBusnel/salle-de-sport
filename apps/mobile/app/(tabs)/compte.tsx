import { ScrollView, Text, View } from "react-native";
import { Button, ErrorState, Loading, Notice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-neutral-100 py-3">
      <Text className="text-base text-neutral-700">{label}</Text>
      <Text className="text-base font-semibold text-neutral-900">{value}</Text>
    </View>
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

  return (
    <ScrollView contentContainerClassName="gap-5 px-5 py-6">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900">
          {member.first_name} {member.last_name}
        </Text>
        <Text className="text-base text-neutral-500">{member.email}</Text>
        <Text className="text-base text-neutral-500">{gym.name}</Text>
      </View>

      {member.status === "prospect" ? <Notice>{t("account.prospectHint")}</Notice> : null}

      <View className="rounded-lg border border-neutral-100 bg-neutral-0 px-4">
        <Row label={t("account.status")} value={t(`account.memberStatus.${member.status}`)} />
        <Row
          label={t("account.subscription")}
          value={hasSubscription ? t("account.activeSubscription") : t("account.noSubscription")}
        />
        <Row label={t("account.credits")} value={String(credits)} />
        <Row label={t("account.attendance")} value={String(attended)} />
        <Row label={t("account.noShows")} value={String(noShows)} />
      </View>
      <Text className="text-sm text-neutral-500">
        {t("account.upcomingLimit", { count: gym.settings.max_upcoming_bookings })}
      </Text>

      <Button
        label={t("account.signOut")}
        variant="secondary"
        onPress={() => supabase.auth.signOut()}
      />
    </ScrollView>
  );
}
