import Ionicons from "@expo/vector-icons/Ionicons";
import { semantic } from "@salle/ui";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Card, EmptyState, ErrorState, Loading } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

type Message = { id: string; subject: string; body: string; created_at: string };

function fetchMessages(memberId: string) {
  return supabase
    .from("outbound_messages")
    .select("id, subject, body, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50);
}

/** Avis reçus de la salle (séance annulée, déplacée…) : lecture seule, les plus récents d'abord. */
export default function MessagesScreen() {
  const { state } = useMember();
  const memberId = state.status === "ready" ? state.member.id : null;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    if (!memberId) return;
    const { data, error } = await fetchMessages(memberId);
    setFailed(Boolean(error));
    if (data) setMessages(data);
  }

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    void fetchMessages(memberId).then(({ data, error }) => {
      if (!active) return;
      setFailed(Boolean(error));
      if (data) setMessages(data);
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  if (state.status !== "ready" || (messages === null && !failed)) return <Loading />;
  if (failed && messages === null)
    return <ErrorState message={t("common.unexpectedError")} onRetry={load} />;

  const format = new Intl.DateTimeFormat("fr-FR", {
    timeZone: state.gym.timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <FlatList
      data={messages ?? []}
      keyExtractor={(m) => m.id}
      contentContainerClassName="gap-3 px-4 py-5"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon={<Ionicons name="mail-outline" size={22} color={semantic["muted-foreground"]} />}
          title={t("messages.empty")}
          body={t("messages.emptyHint")}
        />
      }
      renderItem={({ item }) => {
        const expanded = open === item.id;
        return (
          <Pressable
            onPress={() => setOpen(expanded ? null : item.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <Card className="gap-1.5 px-4 py-3.5">
              <View className="flex-row items-start gap-3">
                <Text className="flex-1 text-base font-semibold text-foreground">
                  {item.subject}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {format.format(new Date(item.created_at))}
                </Text>
              </View>
              <Text
                className="text-sm text-muted-foreground"
                numberOfLines={expanded ? undefined : 2}
              >
                {item.body}
              </Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
