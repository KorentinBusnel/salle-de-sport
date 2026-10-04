import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Checkbox, Notice } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

/** Compte existant sans fiche adhérent : acceptation des conditions puis join_gym. */
export default function OnboardingScreen() {
  const { refresh } = useMember();
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const { error: joinError } = await supabase.rpc("join_gym", {
      p_terms_accepted: terms,
      p_waiver_accepted: waiver,
    });
    setBusy(false);
    if (joinError) return setError(errorText(joinError));
    await refresh();
  }

  return (
    <ScrollView contentContainerClassName="gap-5 px-6 py-6">
      <Text className="text-base text-neutral-700">{t("onboarding.body")}</Text>
      <View className="gap-2">
        <Checkbox label={t("auth.acceptTerms")} checked={terms} onChange={setTerms} />
        <Checkbox label={t("auth.acceptWaiver")} checked={waiver} onChange={setWaiver} />
        <Text className="text-xs text-neutral-500">{t("auth.legalPending")}</Text>
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        label={t("onboarding.join")}
        onPress={join}
        busy={busy}
        disabled={!terms || !waiver}
      />
      <Button
        label={t("onboarding.signOut")}
        variant="secondary"
        onPress={() => supabase.auth.signOut()}
      />
    </ScrollView>
  );
}
