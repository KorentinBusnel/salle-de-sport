import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { type CardSession, SessionCard } from "@/components/session-card";
import Ionicons from "@expo/vector-icons/Ionicons";
import { semantic } from "@salle/ui";
import { Chip, EmptyState, ErrorState, Loading, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { planningDays } from "@/lib/planning";
import { supabase } from "@/lib/supabase";

type PlanningSession = CardSession & { discipline_id: string; coach_id: string | null };

const SELECT =
  "id, starts_at, ends_at, capacity, booked_count, waitlist_count, discipline_id, coach_id, disciplines(name, color), coaches(display_name)";

export default function PlanningScreen() {
  const { state, refresh: refreshMember } = useMember();
  const gym = state.status === "ready" ? state.gym : null;
  const [now] = useState(() => new Date());
  const days = useMemo(() => (gym ? planningDays(now, gym.timezone) : []), [gym, now]);

  const [sessions, setSessions] = useState<PlanningSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gym || days.length === 0) return;
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return;
    const { data, error } = await supabase
      .from("class_sessions")
      .select(SELECT)
      .eq("gym_id", gym.id)
      .eq("status", "scheduled")
      .gte("starts_at", new Date(Math.max(first.start.getTime(), Date.now())).toISOString())
      .lt("starts_at", last.end.toISOString())
      .order("starts_at");
    setFailed(Boolean(error));
    if (data) setSessions(data);
  }, [gym, days]);

  useEffect(() => {
    // Chargement réseau : l'état n'est modifié qu'à la réponse de Supabase (asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Places restantes en direct : chaque réservation met à jour les compteurs de la séance.
  useEffect(() => {
    if (!gym) return;
    const channel = supabase
      .channel(`planning-${gym.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "class_sessions",
          filter: `gym_id=eq.${gym.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            booked_count: number;
            waitlist_count: number;
            status: string;
          };
          setSessions(
            (current) =>
              current
                ?.filter((s) => !(s.id === row.id && row.status !== "scheduled"))
                .map((s) =>
                  s.id === row.id
                    ? { ...s, booked_count: row.booked_count, waitlist_count: row.waitlist_count }
                    : s,
                ) ?? null,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gym]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshMember()]);
    setRefreshing(false);
  }, [load, refreshMember]);

  const mine = useMemo(() => {
    const map = new Map<string, { status: string; position: number | null }>();
    if (state.status === "ready") {
      for (const b of state.bookings) {
        if (b.status === "confirmed" || b.status === "waitlisted") {
          map.set(b.session_id, { status: b.status, position: b.waitlist_position });
        }
      }
    }
    return map;
  }, [state]);

  if (state.status === "loading") return <Loading />;
  if (state.status !== "ready" || !gym)
    return <ErrorState message={t("common.unexpectedError")} onRetry={refreshMember} />;
  if (failed && !sessions) return <ErrorState message={t("planning.loadError")} onRetry={load} />;
  if (!sessions)
    return (
      <View className="gap-3 px-4 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </View>
    );

  const selectedDay = days.find((d) => d.key === dayKey) ?? days[0];
  const disciplines = [...new Map(sessions.map((s) => [s.discipline_id, s.disciplines])).entries()];
  const coaches = [
    ...new Map(
      sessions.filter((s) => s.coach_id).map((s) => [s.coach_id as string, s.coaches]),
    ).entries(),
  ];
  const visible = sessions.filter(
    (s) =>
      selectedDay &&
      Date.parse(s.starts_at) >= selectedDay.start.getTime() &&
      Date.parse(s.starts_at) < selectedDay.end.getTime() &&
      (!discipline || s.discipline_id === discipline) &&
      (!coach || s.coach_id === coach),
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(s) => s.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      contentContainerClassName="pb-8"
      ListHeaderComponent={
        <View className="gap-3 pb-3 pt-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4"
          >
            {days.map((day) => (
              <Chip
                key={day.key}
                label={day.label}
                sublabel={day.date || undefined}
                selected={day.key === selectedDay?.key}
                onPress={() => setDayKey(day.key)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4"
          >
            <Chip
              label={t("planning.allDisciplines")}
              selected={!discipline}
              onPress={() => setDiscipline(null)}
            />
            {disciplines.map(([id, d]) => (
              <Chip
                key={id}
                label={d?.name ?? ""}
                color={d?.color}
                selected={discipline === id}
                onPress={() => setDiscipline(discipline === id ? null : id)}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4"
          >
            <Chip
              label={t("planning.allCoaches")}
              selected={!coach}
              onPress={() => setCoach(null)}
            />
            {coaches.map(([id, c]) => (
              <Chip
                key={id}
                label={c?.display_name ?? ""}
                selected={coach === id}
                onPress={() => setCoach(coach === id ? null : id)}
              />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon={
            <Ionicons
              name="calendar-clear-outline"
              size={22}
              color={semantic["muted-foreground"]}
            />
          }
          title={t("planning.empty")}
          body={t("planning.emptyHint")}
        />
      }
      renderItem={({ item }) => (
        <SessionCard
          session={item}
          timeZone={gym.timezone}
          myStatus={mine.get(item.id)}
          onPress={() => router.push(`/session/${item.id}`)}
        />
      )}
    />
  );
}
