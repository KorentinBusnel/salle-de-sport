import "../global.css";
import { semantic } from "@salle/ui";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ToastProvider } from "@/components/toast";
import { Loading } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { MemberProvider, useMember } from "@/lib/member";

function RootNavigator() {
  const { loading, session } = useAuth();
  const { state } = useMember();
  if (loading) return <Loading />;

  const signedIn = session !== null;
  const needsOnboarding = signedIn && state.status === "none";

  return (
    <Stack
      screenOptions={{
        headerTintColor: semantic.foreground,
        headerStyle: { backgroundColor: semantic.card },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: semantic.background },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: t("auth.signupTitle") }} />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ title: t("onboarding.title") }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsOnboarding}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ title: t("session.title") }} />
        <Stack.Screen name="messages" options={{ title: t("messages.title") }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <MemberProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </ToastProvider>
      </MemberProvider>
    </AuthProvider>
  );
}
