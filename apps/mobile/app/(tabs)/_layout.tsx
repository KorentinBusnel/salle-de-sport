import Ionicons from "@expo/vector-icons/Ionicons";
import { semantic } from "@salle/ui";
import { Tabs } from "expo-router";
import { t } from "@/lib/i18n";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: semantic.primary,
        tabBarInactiveTintColor: semantic["muted-foreground"],
        headerTintColor: semantic.foreground,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: semantic.card },
        tabBarStyle: { backgroundColor: semantic.card, borderTopColor: semantic.border },
        sceneStyle: { backgroundColor: semantic.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.planning"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: t("tabs.bookings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: t("tabs.account"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
