import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMoney, PAYMENT_STATUS_TONE, type PaymentStatus } from "@salle/shared";
import { semantic } from "@salle/ui";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Card, EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  method: "card" | "sepa_debit" | "cash" | "other";
  description: string | null;
  paid_at: string | null;
  created_at: string;
};

function fetchPayments(memberId: string) {
  return supabase
    .from("payments")
    .select("id, amount_cents, currency, status, method, description, paid_at, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(100);
}

/** Paiements de l'adhérent (achats sur place et en ligne), les plus récents d'abord. */
export default function PaymentsScreen() {
  const { state } = useMember();
  const memberId = state.status === "ready" ? state.member.id : null;
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!memberId) return;
    const { data, error } = await fetchPayments(memberId);
    setFailed(Boolean(error));
    if (data) setPayments(data);
  }

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    void fetchPayments(memberId).then(({ data, error }) => {
      if (!active) return;
      setFailed(Boolean(error));
      if (data) setPayments(data);
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  if (state.status !== "ready" || (payments === null && !failed)) return <Loading />;
  if (failed && payments === null)
    return <ErrorState message={t("common.unexpectedError")} onRetry={load} />;

  const format = new Intl.DateTimeFormat("fr-FR", {
    timeZone: state.gym.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <FlatList
      data={payments ?? []}
      keyExtractor={(p) => p.id}
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
          icon={<Ionicons name="card-outline" size={22} color={semantic["muted-foreground"]} />}
          title={t("payments.empty")}
          body={t("payments.emptyHint")}
        />
      }
      renderItem={({ item }) => (
        <Card className="gap-1 px-4 py-3.5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-base font-medium text-foreground" numberOfLines={1}>
              {item.description ?? "—"}
            </Text>
            <Text className="text-base font-semibold text-foreground tabular-nums">
              {formatMoney(item.amount_cents, item.currency)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xs text-muted-foreground">
              {format.format(new Date(item.paid_at ?? item.created_at))} ·{" "}
              {t(`payments.method.${item.method}`)}
            </Text>
            <StatusPill
              tone={PAYMENT_STATUS_TONE[item.status]}
              label={t(`payments.status.${item.status}`)}
            />
          </View>
        </Card>
      )}
    />
  );
}
