import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Field, Notice } from "@/components/ui";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) setError(t("auth.invalidCredentials"));
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center gap-6 px-6 py-10">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-neutral-900">{t("auth.loginTitle")}</Text>
            <Text className="text-base text-neutral-500">{t("auth.loginSubtitle")}</Text>
          </View>
          <View className="gap-4">
            <Field
              label={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label={t("auth.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
            />
          </View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button
            label={t("auth.login")}
            onPress={submit}
            busy={busy}
            disabled={!email || !password}
          />
          <Link href="/signup" className="text-center text-base font-medium text-brand-700">
            {t("auth.toSignup")}
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
