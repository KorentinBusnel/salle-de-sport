import Ionicons from "@expo/vector-icons/Ionicons";
import { canCancelSubscription, formatPrice, MEMBER_STATUS_TONE } from "@salle/shared";
import { semantic } from "@salle/ui";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useToast } from "@/components/toast";
import { Button, Card, ErrorState, Loading, Notice, StatusPill } from "@/components/ui";
import { callBilling } from "@/lib/billing";
import { confirmAsync } from "@/lib/confirm";
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

/** Ligne cliquable vers un écran empilé (messages, paiements, offres). */
function LinkRow({
  icon,
  title,
  hint,
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  href: "/messages" | "/paiements" | "/offres";
}) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      className="active:scale-[0.98]"
    >
      <Card className="flex-row items-center gap-3 px-4 py-3.5">
        <Ionicons name={icon} size={20} color={semantic.foreground} />
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">{title}</Text>
          <Text className="text-xs text-muted-foreground">{hint}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={semantic["muted-foreground"]} />
      </Card>
    </Pressable>
  );
}

export default function AccountScreen() {
  const { state, refresh } = useMember();
  const toast = useToast();
  const [busy, setBusy] = useState<"portal" | "cancel" | null>(null);
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ready")
    return <ErrorState message={t("common.unexpectedError")} onRetry={refresh} />;

  const { member, gym, credits, hasSubscription, subscription, commitmentRunning, lots, bookings } =
    state;
  const day = new Intl.DateTimeFormat("fr-FR", {
    timeZone: gym.timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const attended = bookings.filter((b) => b.status === "attended").length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const initials = `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();
  // Abonnement payé en ligne, pas encore résilié : l'adhérent le résilie seul après l'engagement.
  const online = subscription?.stripe_subscription_id != null && subscription.cancel_at === null;
  const cancellable = online && canCancelSubscription(subscription.commitment_ends_at, new Date());

  /** Portail Stripe : moyen de paiement et factures, dans le navigateur intégré. */
  async function openPortal() {
    setBusy("portal");
    const result = await callBilling<{ url: string }>({
      action: "portal",
      returnUrl: Linking.createURL("compte"),
    });
    setBusy(null);
    if (result.error !== null) {
      toast("error", result.error);
      return;
    }
    await WebBrowser.openBrowserAsync(result.data.url);
    await refresh();
  }

  async function cancel() {
    if (!subscription?.current_period_end) return;
    const date = day.format(new Date(subscription.current_period_end));
    const ok = await confirmAsync(t("account.cancelTitle"), t("account.cancelBody", { date }));
    if (!ok) return;
    setBusy("cancel");
    const result = await callBilling<{ ok: true }>({ action: "cancel" });
    setBusy(null);
    if (result.error !== null) {
      toast("error", result.error);
      return;
    }
    toast("success", t("account.cancelled", { date }));
    await refresh();
  }

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
        {subscription?.plans ? (
          <>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-base font-semibold text-foreground">
                {subscription.plans.name}
              </Text>
              {subscription.status === "past_due" ? (
                <StatusPill tone="danger" label={t("account.pastDue")} />
              ) : null}
            </View>
            <Text className="text-sm text-muted-foreground tabular-nums">
              {formatPrice(subscription.plans)}
            </Text>
            {subscription.current_period_end ? (
              <Text className="text-sm text-foreground">
                {t(subscription.cancel_at ? "account.endsOn" : "account.paidUntil", {
                  date: day.format(new Date(subscription.current_period_end)),
                })}
              </Text>
            ) : null}
            {commitmentRunning && subscription.commitment_ends_at ? (
              <Text className="text-xs text-muted-foreground">
                {t("account.commitmentUntil", {
                  date: day.format(new Date(subscription.commitment_ends_at)),
                })}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="text-base font-semibold text-foreground">
            {hasSubscription ? t("account.activeSubscription") : t("account.noSubscription")}
          </Text>
        )}
        <Text className="text-xs text-muted-foreground">{gym.name}</Text>
      </Card>

      {member.stripe_customer_id || online ? (
        <View className="gap-2">
          {member.stripe_customer_id ? (
            <Button
              label={t("account.managePayment")}
              variant="secondary"
              busy={busy === "portal"}
              onPress={() => void openPortal()}
            />
          ) : null}
          {online ? (
            <>
              <Button
                label={t("account.cancelSubscription")}
                variant="secondary"
                disabled={!cancellable}
                busy={busy === "cancel"}
                onPress={() => void cancel()}
              />
              {!cancellable && subscription.commitment_ends_at ? (
                <Text className="px-1 text-xs text-muted-foreground">
                  {t("account.cancelAfter", {
                    date: day.format(new Date(subscription.commitment_ends_at)),
                  })}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row gap-3">
        <Stat label={t("account.credits")} value={credits} />
        <Stat label={t("account.attendance")} value={attended} />
        <Stat label={t("account.noShows")} value={noShows} />
      </View>

      <Text className="px-1 text-sm text-muted-foreground">
        {t("account.upcomingLimit", { count: gym.settings.max_upcoming_bookings })}
      </Text>

      {lots.length ? (
        <Card className="gap-2 px-4 py-3.5">
          <Text className="text-xs text-muted-foreground">{t("account.creditLots")}</Text>
          {lots.map((lot) => (
            <View key={lot.id} className="flex-row items-baseline justify-between gap-3">
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                {lot.name ?? t("account.manualCredits")}
              </Text>
              <Text className="text-sm font-medium text-foreground tabular-nums">
                {t("account.creditCount", { count: lot.remaining })}
              </Text>
              <Text className="w-32 text-right text-xs text-muted-foreground">
                {lot.expiresAt
                  ? t("account.expiresOn", { date: day.format(new Date(lot.expiresAt)) })
                  : t("account.noExpiry")}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <LinkRow
        icon="pricetags-outline"
        title={t("offers.title")}
        hint={t("offers.hint")}
        href="/offres"
      />
      <LinkRow
        icon="card-outline"
        title={t("payments.title")}
        hint={t("payments.hint")}
        href="/paiements"
      />
      <LinkRow
        icon="mail-outline"
        title={t("messages.title")}
        hint={t("messages.hint")}
        href="/messages"
      />

      <Button
        label={t("account.signOut")}
        variant="secondary"
        onPress={() => supabase.auth.signOut()}
      />
    </ScrollView>
  );
}
