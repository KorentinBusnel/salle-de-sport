import { TONE_CLASSES, type Tone, occupancy } from "@salle/shared";
import { colors, semantic, shadows } from "@salle/ui";
import { type ReactNode, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { t } from "@/lib/i18n";

type ButtonVariant = "primary" | "secondary" | "destructive";

// Appui : léger rétrécissement (0.96) et teinte, comme sur le back office.
const BUTTON: Record<ButtonVariant, { box: string; text: string }> = {
  primary: { box: "bg-primary active:bg-brand-700", text: "text-primary-foreground" },
  secondary: {
    box: "border border-border bg-card active:bg-muted",
    text: "text-foreground",
  },
  destructive: {
    box: "border border-destructive/30 bg-destructive/10 active:bg-destructive/20",
    text: "text-destructive",
  },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
}) {
  const style = BUTTON[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      className={`min-h-12 flex-row items-center justify-center rounded-xl px-5 py-3 active:scale-[0.96] ${style.box} ${disabled ? "opacity-50" : ""}`}
    >
      {busy ? (
        <ActivityIndicator
          color={variant === "primary" ? semantic["primary-foreground"] : semantic.primary}
        />
      ) : (
        <Text className={`text-base font-semibold ${style.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Surface de carte : ombre en couches (Watermelon), rayon xl. */
export function Card({ className = "", style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-xl bg-card ${className}`}
      style={[{ boxShadow: shadows.border }, style]}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={semantic["muted-foreground"]}
        className="min-h-12 rounded-xl border border-input bg-card px-3.5 text-base text-foreground focus:border-ring"
        {...props}
      />
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      className="min-h-11 flex-row items-center gap-3 py-1"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          checked ? "border-primary bg-primary" : "border-input bg-card"
        }`}
      >
        {checked ? <Text className="text-sm font-bold text-primary-foreground">✓</Text> : null}
      </View>
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  sublabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string | undefined;
  sublabel?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-10 flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:scale-[0.96] ${
        selected ? "bg-foreground" : "border border-border bg-card"
      }`}
    >
      {color ? (
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <Text
        className={`text-sm ${selected ? "font-semibold text-card" : "font-medium text-foreground"}`}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text className={`text-xs ${selected ? "text-card/80" : "text-muted-foreground"}`}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Sépare les classes de fond et de texte d'une pastille (le texte RN ne s'hérite pas). */
function splitPill(pill: string): [string, string] {
  const parts = pill.split(" ");
  return [
    parts.filter((c) => !c.startsWith("text-")).join(" "),
    parts.filter((c) => c.startsWith("text-")).join(" "),
  ];
}

/** Pastille de statut « soft » (tons partagés avec le back office). */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const classes = TONE_CLASSES[tone];
  const [background, textColor] = splitPill(classes.pill);
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${background}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
      <Text className={`text-xs font-semibold ${textColor}`}>{label}</Text>
    </View>
  );
}

/** Jauge d'occupation ; le remplissage suit les mises à jour en direct. */
export function Gauge({
  booked,
  capacity,
  className = "",
}: {
  booked: number;
  capacity: number;
  className?: string;
}) {
  const ratio = occupancy(capacity, booked);
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 300 });
  }, [ratio, progress]);
  // Les composants animés ne reçoivent pas les classes NativeWind : style animé seul,
  // couleurs portées par une vue enfant. Largeur en flex (fiable sur iOS, Android et web).
  const fill = useAnimatedStyle(() => ({ flexGrow: progress.value }));
  const rest = useAnimatedStyle(() => ({ flexGrow: 1 - progress.value }));
  const full = capacity > 0 && booked >= capacity;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: capacity, now: booked }}
      className={`h-1.5 flex-row overflow-hidden rounded-full bg-muted ${className}`}
    >
      <Animated.View style={[{ flexBasis: 0 }, fill]}>
        <View className={`h-full rounded-full ${full ? "bg-warning" : "bg-primary"}`} />
      </Animated.View>
      <Animated.View style={[{ flexBasis: 0 }, rest]} />
    </View>
  );
}

/** Nombre qui « roule » quand il change (places mises à jour en direct). */
export function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  return (
    <View className="overflow-hidden">
      <Animated.View
        key={value}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(160)}
      >
        <Text className={`tabular-nums ${className}`}>{value}</Text>
      </Animated.View>
    </View>
  );
}

const NOTICE = {
  info: { box: "bg-muted", text: "text-foreground" },
  success: { box: "bg-success/10", text: "text-success" },
  error: { box: "bg-destructive/10", text: "text-destructive" },
} as const;

/** Message durable (statut de la séance, fiche à activer…). Les retours d'action passent par Toast. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof NOTICE;
  children: ReactNode;
}) {
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      className={`rounded-xl px-3.5 py-3 ${NOTICE[tone].box}`}
    >
      <Text className={`text-sm leading-5 ${NOTICE[tone].text}`}>{children}</Text>
    </View>
  );
}

/** Bloc de chargement qui pulse doucement. */
export function Skeleton({ className = "" }: { className?: string }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={style}>
      <View className={`rounded-xl bg-muted ${className}`} />
    </Animated.View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.brand[600]} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <View className="items-center gap-2 px-8 py-12">
      <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </View>
      <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted-foreground">{body}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
      <Text className="text-center text-base text-foreground">{message}</Text>
      <Button label={t("common.retry")} onPress={onRetry} />
    </View>
  );
}
