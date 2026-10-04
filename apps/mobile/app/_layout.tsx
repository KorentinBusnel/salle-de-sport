import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@salle/ui";
import { t } from "@/lib/i18n";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.neutral[900],
          headerStyle: { backgroundColor: colors.neutral[0] },
          contentStyle: { backgroundColor: colors.neutral[50] },
        }}
      >
        <Stack.Screen name="index" options={{ title: t("planning.title") }} />
      </Stack>
    </>
  );
}
