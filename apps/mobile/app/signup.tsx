import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { z } from "zod";
import { Button, Checkbox, Field, Notice } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { useMember } from "@/lib/member";
import { supabase } from "@/lib/supabase";

const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(72),
});

export default function SignupScreen() {
  const { refresh } = useMember();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    const parsed = signupSchema.safeParse({ ...form, email: form.email.trim() });
    if (!parsed.success) return setMessage({ tone: "error", text: t("auth.invalidForm") });
    if (!terms || !waiver) return setMessage({ tone: "error", text: t("auth.mustAccept") });

    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName } },
    });
    if (error) {
      setBusy(false);
      const taken = error.message.toLowerCase().includes("already");
      return setMessage({
        tone: "error",
        text: taken ? t("auth.emailTaken") : t("common.unexpectedError"),
      });
    }
    if (!data.session) {
      // Confirmation d'email activée sur le projet : la session viendra après le lien.
      setBusy(false);
      return setMessage({ tone: "success", text: t("auth.checkEmail") });
    }
    const { error: joinError } = await supabase.rpc("join_gym", {
      p_terms_accepted: true,
      p_waiver_accepted: true,
    });
    setBusy(false);
    if (joinError) return setMessage({ tone: "error", text: errorText(joinError) });
    await refresh();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        <Text className="text-base text-muted-foreground">{t("auth.signupSubtitle")}</Text>
        <View className="gap-4">
          <Field
            label={t("auth.firstName")}
            value={form.firstName}
            onChangeText={set("firstName")}
            autoComplete="given-name"
          />
          <Field
            label={t("auth.lastName")}
            value={form.lastName}
            onChangeText={set("lastName")}
            autoComplete="family-name"
          />
          <Field
            label={t("auth.email")}
            value={form.email}
            onChangeText={set("email")}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label={t("auth.password")}
            hint={t("auth.passwordHint")}
            value={form.password}
            onChangeText={set("password")}
            secureTextEntry
            autoComplete="new-password"
          />
        </View>
        <View className="gap-2">
          <Checkbox label={t("auth.acceptTerms")} checked={terms} onChange={setTerms} />
          <Checkbox label={t("auth.acceptWaiver")} checked={waiver} onChange={setWaiver} />
          <Text className="text-xs text-muted-foreground">{t("auth.legalPending")}</Text>
        </View>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Button label={t("auth.signup")} onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
