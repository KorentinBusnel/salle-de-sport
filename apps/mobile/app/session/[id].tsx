import Ionicons from "@expo/vector-icons/Ionicons";
import { canCancel, isLateCancellation, spotsLeft } from "@salle/shared";
import { colors, semantic } from "@salle/ui";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorState, Gauge, Loading, Notice, RollingNumber } from "@/components/ui";
import { addSessionToCalendar, calendarAvailable } from "@/lib/calendar";
import { confirmAsync } from "@/lib/confirm";
import { errorText } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

type SessionDetail = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number;
  status: "scheduled" | "cancelled";
  cancellation_reason: string | null;
  disciplines: { name: string; color: string } | null;
  coaches: { display_name: string } | null;
  rooms: { name: string } | null;
};

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refresh: refreshMember } = useMember();
  const [session, setSession] = useState<SessionDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, booked_count, waitlist_count, status, cancellation_reason, disciplines(name, color), coaches(display_name), rooms(name)",
      )
      .eq("id", id)
      .maybeSingle();
    setSession(data);
    setNow(new Date());
  }, [id]);

  useEffect(() => {
    // Chargement réseau : l'état n'est modifié qu'à la réponse de Supabase (asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const channel = supabase
      .channel(`session-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "class_sessions", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Pick<
            SessionDetail,
            "booked_count" | "waitlist_count" | "status"
          >;
          setSession((current) => (current ? { ...current, ...row } : current));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  if (state.status === "loading" || session === undefined) return <Loading />;
  if (state.status !== "ready")
    return <ErrorState message={t("common.unexpectedError")} onRetry={refreshMember} />;
  if (session === null) return <ErrorState message={t("session.notFound")} onRetry={load} />;

  const { gym, member } = state;
  const booking = state.bookings.find(
    (b) => b.session_id === session.id && b.status !== "cancelled",
  );
  const startsAt = new Date(session.starts_at);
  const started = !canCancel(startsAt, now);
  const cancelled = session.status === "cancelled";
  const full = spotsLeft(session.capacity, session.booked_count) === 0;
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: gym.timezone, ...options });
  const day = format({ weekday: "long", day: "numeric", month: "long" }).format(startsAt);
  const time = format({ hour: "2-digit", minute: "2-digit" });

  async function run(
    action: () => PromiseLike<{ error: { message?: string } | null }>,
    success: string,
  ) {
    setBusy(true);
    const { error } = await action();
    await Promise.all([refreshMember(), load()]);
    setBusy(false);
    toast(error ? "error" : "success", error ? errorText(error) : success);
  }

  async function book() {
    await run(
      () => supabase.rpc("book_session", { p_session_id: session!.id }),
      full ? t("session.waitlistedToast") : t("session.bookedToast"),
    );
  }

  async function cancel() {
    if (!booking) return;
    const late =
      booking.status === "confirmed" &&
      isLateCancellation(startsAt, new Date(), gym.settings.cancellation_recommended_hours);
    if (late) {
      const ok = await confirmAsync(
        t("session.lateTitle"),
        t("session.lateBody", { hours: gym.settings.cancellation_recommended_hours }),
      );
      if (!ok) return;
    }
    await run(
      () => supabase.rpc("cancel_booking", { p_booking_id: booking.id }),
      t("session.cancelledToast"),
    );
  }

  async function addToCalendar() {
    const result = await addSessionToCalendar({
      title: `${session!.disciplines?.name ?? ""} · ${gym.name}`,
      startsAt: session!.starts_at,
      endsAt: session!.ends_at,
      location: gym.name,
      timeZone: gym.timezone,
    });
    toast(result.ok ? "success" : "error", result.message);
  }

  const status = cancelled ? (
    <Notice tone="error">{t("session.cancelled")}</Notice>
  ) : booking?.status === "attended" ? (
    <Notice tone="success">{t("session.attended")}</Notice>
  ) : booking?.status === "no_show" ? (
    <Notice>{t("session.noShow")}</Notice>
  ) : started ? (
    <Notice>{t("session.started")}</Notice>
  ) : booking ? (
    <Notice tone="success">
      {booking.status === "waitlisted"
        ? t("session.youAreWaitlisted", { position: booking.waitlist_position ?? "?" })
        : t("session.youAreBooked")}
    </Notice>
  ) : member.status !== "active" ? (
    <Notice>{t("session.notActive")}</Notice>
  ) : null;

  // Action principale ancrée en bas d'écran, à portée de pouce.
  const actions =
    cancelled ||
    started ||
    booking?.status === "attended" ||
    booking?.status === "no_show" ? null : booking ? (
      <View className="gap-2">
        <Button
          label={booking.status === "waitlisted" ? t("session.leaveWaitlist") : t("session.cancel")}
          variant="destructive"
          onPress={cancel}
          busy={busy}
        />
        {calendarAvailable ? (
          <Button label={t("session.addToCalendar")} variant="secondary" onPress={addToCalendar} />
        ) : null}
      </View>
    ) : member.status === "active" ? (
      <Button
        label={full ? t("session.joinWaitlist") : t("session.book")}
        onPress={book}
        busy={busy}
      />
    ) : null;

  const color = session.disciplines?.color ?? colors.neutral[300];
  const details = [
    {
      icon: "time-outline" as const,
      text: `${time.format(startsAt)} – ${time.format(new Date(session.ends_at))}`,
    },
    session.coaches
      ? {
          icon: "person-outline" as const,
          text: t("session.with", { coach: session.coaches.display_name }),
        }
      : null,
    session.rooms
      ? { icon: "location-outline" as const, text: t("session.room", { room: session.rooms.name }) }
      : null,
  ].filter((d) => d !== null);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 px-4 py-5">
        <Card className="overflow-hidden">
          <View className="h-1.5" style={{ backgroundColor: color }} />
          <View className="gap-3 px-4 py-4">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-foreground">
                {session.disciplines?.name}
              </Text>
              <Text className="text-base text-muted-foreground">
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
            </View>
            <View className="gap-2">
              {details.map((detail) => (
                <View key={detail.icon} className="flex-row items-center gap-2">
                  <Ionicons name={detail.icon} size={16} color={semantic["muted-foreground"]} />
                  <Text className="text-base text-foreground tabular-nums">{detail.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Card className="gap-3 px-4 py-4">
          <View className="flex-row items-end justify-between">
            <Text className="text-sm text-muted-foreground">{t("session.spotsTaken")}</Text>
            <View className="flex-row items-baseline">
              <RollingNumber
                value={session.booked_count}
                className="text-2xl font-semibold text-foreground"
              />
              <Text className="text-base text-muted-foreground tabular-nums">
                /{session.capacity}
              </Text>
            </View>
          </View>
          <Gauge booked={session.booked_count} capacity={session.capacity} />
          {session.waitlist_count > 0 ? (
            <Text className="text-sm text-muted-foreground">
              {t("session.waitlistCount", { count: session.waitlist_count })}
            </Text>
          ) : null}
        </Card>

        {status}
      </ScrollView>
      {actions ? (
        <View
          className="border-t border-border bg-card px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}
