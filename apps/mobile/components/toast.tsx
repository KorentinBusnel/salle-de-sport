import * as Haptics from "expo-haptics";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shadows } from "@salle/ui";

type ToastTone = "success" | "error" | "info";
type ToastMessage = { id: number; tone: ToastTone; text: string };

const ToastContext = createContext<(tone: ToastTone, text: string) => void>(() => {});

const TONES: Record<ToastTone, { box: string; text: string }> = {
  success: { box: "bg-card border-l-4 border-success", text: "text-foreground" },
  error: { box: "bg-card border-l-4 border-destructive", text: "text-foreground" },
  info: { box: "bg-card border-l-4 border-border", text: "text-foreground" },
};

/** Retours d'action éphémères en haut de l'écran, avec retour haptique. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((tone: ToastTone, text: string) => {
    setToast({ id: Date.now(), tone, text });
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(
        tone === "error"
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Success,
      );
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.tone === "error" ? 5000 : 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 px-4"
        style={{ top: insets.top + 8 }}
      >
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(160)}
            accessibilityLiveRegion="polite"
            accessibilityRole={toast.tone === "error" ? "alert" : "text"}
          >
            {/* Classes NativeWind sur une vue simple : les vues animées ne les reçoivent pas. */}
            <View
              className={`rounded-xl px-4 py-3 ${TONES[toast.tone].box}`}
              style={{ boxShadow: shadows["border-hover"] }}
            >
              <Text className={`text-sm font-medium ${TONES[toast.tone].text}`}>{toast.text}</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
