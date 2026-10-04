import { Alert, Platform } from "react-native";
import { t } from "@/lib/i18n";

/** Demande une confirmation (Alert natif ; window.confirm sur le web, où Alert ne fait rien). */
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("common.confirm"), style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
