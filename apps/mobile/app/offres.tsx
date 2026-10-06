import { formatPrice, type BillingInterval, type PlanType } from "@salle/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorState, Field, Loading, Notice } from "@/components/ui";
import { callBilling, onlinePaymentEnabled, type PaymentSheetParams } from "@/lib/billing";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { presentPurchase } from "@/lib/payment-sheet";
import { supabase } from "@/lib/supabase";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  type: PlanType;
  price_cents: number;
  currency: string;
  billing_interval: BillingInterval | null;
  commitment_months: number | null;
  credits: number | null;
  validity_days: number | null;
  audience: string | null;
  requires_proof: boolean;
  all_disciplines: boolean;
  plan_disciplines: { disciplines: { name: string } | null }[];
};

function fetchPlans(gymId: string) {
  return supabase
    .from("plans")
    .select(
      "id, name, description, type, price_cents, currency, billing_interval, commitment_months, credits, validity_days, audience, requires_proof, all_disciplines, plan_disciplines(disciplines(name))",
    )
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("position")
    .order("name");
}

/**
 * Offres de la salle et achat dans l'app (feuille de paiement Stripe ; prélèvement SEPA pour un
 * abonnement). Sans clé Stripe dans l'app, les offres restent consultables, achat à l'accueil.
 */
export default function OffersScreen() {
  const { state, refresh } = useMember();
  const toast = useToast();
  const gymId = state.status === "ready" ? state.gym.id : null;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [promo, setPromo] = useState("");
  const [buying, setBuying] = useState<string | null>(null);

  async function buy(plan: Plan) {
    if (state.status !== "ready") return;
    setBuying(plan.id);
    try {
      const code = promo.trim();
      const sheet = await callBilling<PaymentSheetParams>({
        action: "payment_sheet",
        planId: plan.id,
        ...(code ? { promoCode: code } : {}),
      });
      if (sheet.error !== null) {
        toast("error", sheet.error);
        return;
      }
      const outcome = await presentPurchase(sheet.data, {
        merchantName: state.gym.name,
        email: state.member.email,
        name: `${state.member.first_name} ${state.member.last_name}`,
      });
      if (outcome.status === "canceled") return;
      if (outcome.status === "failed") {
        toast("error", outcome.message);
        return;
      }
      toast("success", t(plan.type === "recurring" ? "offers.subscribed" : "offers.paid"));
      // Crédits et abonnement arrivent par le webhook : relecture tout de suite, puis un peu après.
      await refresh();
      setTimeout(() => void refresh(), 3000);
      router.navigate("/");
    } finally {
      setBuying(null);
    }
  }

  async function load() {
    if (!gymId) return;
    const { data, error } = await fetchPlans(gymId);
    setFailed(Boolean(error));
    if (data) setPlans(data);
  }

  useEffect(() => {
    if (!gymId) return;
    let active = true;
    void fetchPlans(gymId).then(({ data, error }) => {
      if (!active) return;
      setFailed(Boolean(error));
      if (data) setPlans(data);
    });
    return () => {
      active = false;
    };
  }, [gymId]);

  if (!gymId || (plans === null && !failed)) return <Loading />;
  const subscribed = state.status === "ready" && state.hasSubscription;
  if (failed && plans === null)
    return <ErrorState message={t("common.unexpectedError")} onRetry={load} />;

  return (
    <FlatList
      data={plans ?? []}
      keyExtractor={(p) => p.id}
      contentContainerClassName="gap-3 px-4 py-5"
      ListHeaderComponent={
        onlinePaymentEnabled ? (
          <View className="gap-3">
            {subscribed ? <Notice>{t("offers.alreadySubscribed")}</Notice> : null}
            <Field
              label={t("offers.promoLabel")}
              hint={t("offers.promoHint")}
              value={promo}
              onChangeText={setPromo}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
            />
          </View>
        ) : (
          <Notice>{t("offers.buySoon")}</Notice>
        )
      }
      ListEmptyComponent={
        <Text className="px-1 text-sm text-muted-foreground">{t("offers.empty")}</Text>
      }
      renderItem={({ item }) => {
        const details =
          item.type === "recurring"
            ? item.commitment_months
              ? t("offers.commitment", { count: item.commitment_months })
              : t("offers.noCommitment")
            : [
                t("offers.credits", { count: item.credits ?? 1 }),
                item.validity_days ? t("offers.validity", { count: item.validity_days }) : null,
              ]
                .filter(Boolean)
                .join(", ");
        const disciplines = item.all_disciplines
          ? t("offers.allDisciplines")
          : item.plan_disciplines
              .map((d) => d.disciplines?.name)
              .filter(Boolean)
              .join(", ");
        return (
          <Card className="gap-1.5 px-4 py-4">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="flex-1 text-base font-semibold text-foreground">{item.name}</Text>
              <Text className="text-base font-semibold text-primary tabular-nums">
                {formatPrice(item)}
              </Text>
            </View>
            {item.description ? (
              <Text className="text-sm text-muted-foreground">{item.description}</Text>
            ) : null}
            <Text className="text-xs text-muted-foreground">
              {details} · {disciplines}
            </Text>
            {item.requires_proof ? (
              <Text className="text-xs font-medium text-foreground">
                {t("offers.proof", { audience: item.audience ?? "" })}
              </Text>
            ) : null}
            {onlinePaymentEnabled && !(item.type === "recurring" && subscribed) ? (
              <View className="pt-2">
                <Button
                  label={t(item.type === "recurring" ? "offers.subscribe" : "offers.buy")}
                  variant={item.type === "recurring" ? "primary" : "secondary"}
                  busy={buying === item.id}
                  disabled={buying !== null && buying !== item.id}
                  onPress={() => void buy(item)}
                />
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}
