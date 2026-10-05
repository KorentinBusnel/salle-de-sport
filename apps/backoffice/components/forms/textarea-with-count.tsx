"use client";

import { useId, useState, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Zone de texte avec compteur (Watermelon textarea-18) : le compteur reste discret, puis passe
 * en alerte sous 10 % restants ; seule cette alerte est annoncée aux lecteurs d'écran.
 */
export function TextareaWithCount({
  maxLength,
  value,
  defaultValue,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "maxLength" | "value" | "defaultValue"> & {
  maxLength: number;
  value?: string | undefined;
  defaultValue?: string | undefined;
}) {
  const counterId = useId();
  const [inner, setInner] = useState(defaultValue ?? "");
  const length = (value ?? inner).length;
  const left = maxLength - length;
  const low = left <= Math.max(5, Math.round(maxLength * 0.1));
  return (
    <div className={cn("grid gap-1", className)}>
      <Textarea
        {...props}
        {...(value !== undefined ? { value } : { defaultValue })}
        maxLength={maxLength}
        aria-describedby={[props["aria-describedby"], counterId].filter(Boolean).join(" ")}
        onChange={(event) => {
          setInner(event.target.value);
          onChange?.(event);
        }}
      />
      <p
        id={counterId}
        className={cn(
          "justify-self-end text-xs tabular-nums",
          low ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        <span aria-hidden>{t("forms.charCount", { count: length, max: maxLength })}</span>
        <span className="sr-only" aria-live="polite">
          {low ? t("forms.charLeft", { count: left }) : ""}
        </span>
      </p>
    </div>
  );
}
