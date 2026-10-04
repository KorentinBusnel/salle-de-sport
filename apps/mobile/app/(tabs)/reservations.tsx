import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BOOKING_STATUS_TONE } from "@salle/shared";
import { colors, semantic, shadows } from "@salle/ui";
import { EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { type MyBooking, useMember } from "@/lib/member";

export default function BookingsScreen() {
  const { state, refresh } = useMember();
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => Date.now());

  if (state.status === "loading") return <Loading />;
  if (state.status !== "ready")
    return <ErrorState message={t("common.unexpectedError")} onRetry={refresh} />;

  const withSession = state.bookings.filter(
    (b): b is MyBooking & { class_sessions: NonNullable<MyBooking["class_sessions"]> } =>
      Boolean(b.class_sessions),
  );
  const upcoming = withSession
    .filter(
      (b) =>
        (b.status === "confirmed" || b.status === "waitlisted") &&
        Date.parse(b.class_sessions.starts_at) > now,
    )
    .sort((a, b) => a.class_sessions.starts_at.localeCompare(b.class_sessions.starts_at));
  const past = withSession
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => b.class_sessions.starts_at.localeCompare(a.class_sessions.starts_at))
    .slice(0, 30);

  const format = new Intl.DateTimeFormat("fr-FR", {
    timeZone: state.gym.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <SectionList
      sections={[
        {
          key: "upcoming",
          title: t("bookings.upcoming"),
          empty: t("bookings.emptyUpcoming"),
          data: upcoming,
        },
        { key: "past", title: t("bookings.past"), empty: t("bookings.emptyPast"), data: past },
      ]}
      keyExtractor={(b) => b.id}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
      contentContainerClassName="pb-8"
      renderSectionHeader={({ section }) => (
        <View>
          <Text className="px-4 pb-2 pt-5 text-sm font-semibold text-muted-foreground">
            {section.title}
          </Text>
          {section.data.length === 0 ? (
            section.key === "upcoming" ? (
              <EmptyState
                icon={
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={semantic["muted-foreground"]}
                  />
                }
                title={section.empty}
              />
            ) : (
              <Text className="px-4 pb-2 text-sm text-muted-foreground">{section.empty}</Text>
            )
          ) : null}
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/session/${item.class_sessions.id}`)}
          className="mx-4 mb-2 flex-row items-center gap-3 rounded-xl bg-card px-4 py-3 active:scale-[0.98] active:bg-muted"
          style={{ boxShadow: shadows.border }}
        >
          <View
            className="h-9 w-1 rounded-full"
            style={{
              backgroundColor: item.class_sessions.disciplines?.color ?? colors.neutral[300],
            }}
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">
              {item.class_sessions.disciplines?.name}
            </Text>
            <Text className="text-sm text-muted-foreground tabular-nums">
              {format.format(new Date(item.class_sessions.starts_at))}
            </Text>
          </View>
          <StatusPill
            tone={BOOKING_STATUS_TONE[item.status]}
            label={
              item.status === "waitlisted"
                ? `${t("bookings.status.waitlisted")} (${item.waitlist_position ?? "?"})`
                : t(`bookings.status.${item.status}`)
            }
          />
        </Pressable>
      )}
    />
  );
}
