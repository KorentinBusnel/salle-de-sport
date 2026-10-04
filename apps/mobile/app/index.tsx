import { zonedDayRange } from "@salle/shared";
import { colors } from "@salle/ui";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { SessionRow } from "@/components/session-row";
import { t } from "@/lib/i18n";
import { groupSessionsByDay, type PlanningDay } from "@/lib/planning";
import { supabase } from "@/lib/supabase";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; timeZone: string; days: PlanningDay[] };

const DAYS_AHEAD = 7;

/** Planning public des 7 prochains jours (lisible sans compte, BRIEF §4). */
async function loadPlanning(): Promise<State> {
  // Une seule salle au lancement : la première.
  const { data: gym, error: gymError } = await supabase
    .from("gyms")
    .select("id, timezone")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (gymError || !gym) return { status: "error" };

  const now = new Date();
  const { start } = zonedDayRange(now, gym.timezone);
  const until = new Date(start.getTime() + DAYS_AHEAD * 86_400_000);

  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, capacity, disciplines(name, color), coaches(display_name)")
    .eq("gym_id", gym.id)
    .eq("status", "scheduled")
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at");
  if (error) return { status: "error" };

  return {
    status: "ready",
    timeZone: gym.timezone,
    days: groupSessionsByDay(data, gym.timezone, now),
  };
}

export default function PlanningScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setState(await loadPlanning());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadPlanning().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.brand[600]} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Text className="text-center text-base text-neutral-700">{t("planning.loadError")}</Text>
        <Pressable
          onPress={refresh}
          className="rounded-md bg-brand-600 px-5 py-3 active:bg-brand-700"
        >
          <Text className="font-semibold text-neutral-0">{t("planning.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SectionList
      sections={state.days}
      keyExtractor={(session) => session.id}
      stickySectionHeadersEnabled
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <Text className="px-4 pb-2 pt-4 text-sm text-neutral-500">{t("planning.subtitle")}</Text>
      }
      ListEmptyComponent={
        <Text className="px-4 py-8 text-center text-neutral-500">{t("planning.empty")}</Text>
      }
      renderSectionHeader={({ section }) => (
        <Text className="bg-neutral-50 px-4 pb-2 pt-5 text-sm font-semibold uppercase tracking-wide text-neutral-700">
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => <SessionRow session={item} timeZone={state.timeZone} />}
      contentContainerClassName="pb-8"
    />
  );
}
