import { colors } from "@salle/ui";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { t } from "@/lib/i18n";

type ButtonVariant = "primary" | "secondary" | "destructive";

const BUTTON: Record<ButtonVariant, { box: string; text: string }> = {
  primary: { box: "bg-brand-600 active:bg-brand-700", text: "text-neutral-0" },
  secondary: {
    box: "border border-neutral-300 bg-neutral-0 active:bg-neutral-100",
    text: "text-neutral-900",
  },
  destructive: {
    box: "border border-danger bg-neutral-0 active:bg-neutral-100",
    text: "text-danger",
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
      className={`min-h-12 flex-row items-center justify-center rounded-md px-5 py-3 ${style.box} ${disabled ? "opacity-50" : ""}`}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.neutral[0] : colors.brand[600]} />
      ) : (
        <Text className={`text-base font-semibold ${style.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.neutral[500]}
        className="min-h-12 rounded-md border border-neutral-300 bg-neutral-0 px-3 text-base text-neutral-900"
        {...props}
      />
      {hint ? <Text className="text-xs text-neutral-500">{hint}</Text> : null}
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
      className="flex-row items-center gap-3 py-1"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded border ${
          checked ? "border-brand-600 bg-brand-600" : "border-neutral-300 bg-neutral-0"
        }`}
      >
        {checked ? <Text className="text-sm font-bold text-neutral-0">✓</Text> : null}
      </View>
      <Text className="flex-1 text-sm text-neutral-700">{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string | undefined;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 ${
        selected ? "border-brand-600 bg-brand-50" : "border-neutral-300 bg-neutral-0"
      }`}
    >
      {color ? (
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <Text className={`text-sm ${selected ? "font-semibold text-brand-700" : "text-neutral-700"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

const NOTICE = {
  info: { box: "border-neutral-300", text: "text-neutral-700" },
  success: { box: "border-success", text: "text-success" },
  error: { box: "border-danger", text: "text-danger" },
} as const;

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
      className={`rounded-md border bg-neutral-0 px-3 py-2.5 ${NOTICE[tone].box}`}
    >
      <Text className={`text-sm ${NOTICE[tone].text}`}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.brand[600]} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-neutral-50 px-8">
      <Text className="text-center text-base text-neutral-700">{message}</Text>
      <Button label={t("common.retry")} onPress={onRetry} />
    </View>
  );
}
