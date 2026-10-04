"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type MessageKey, t } from "@/lib/i18n";

export type SettingsValues = {
  max_upcoming_bookings: string;
  cancellation_recommended_hours: string;
};
export type SettingsState = {
  values: SettingsValues;
  fieldErrors: Partial<Record<keyof SettingsValues, MessageKey>>;
};

/** Règles de réservation : erreurs par champ, bouton actif seulement après une modification. */
export function SettingsForm({
  initial,
  action,
}: {
  initial: SettingsValues;
  action: (state: SettingsState, formData: FormData) => Promise<SettingsState>;
}) {
  const [state, formAction] = useActionState(action, { values: initial, fieldErrors: {} });
  const [draft, setDraft] = useState<SettingsValues | null>(null);
  const values = draft ?? state.values;
  const dirty =
    values.max_upcoming_bookings !== initial.max_upcoming_bookings ||
    values.cancellation_recommended_hours !== initial.cancellation_recommended_hours;
  const fields = [
    {
      name: "max_upcoming_bookings",
      label: t("settings.maxUpcoming"),
      hint: t("settings.maxUpcomingHint"),
      min: 1,
      max: 50,
    },
    {
      name: "cancellation_recommended_hours",
      label: t("settings.recommendedHours"),
      hint: t("settings.recommendedHoursHint"),
      min: 0,
      max: 72,
    },
  ] as const;

  return (
    <form action={formAction} onSubmit={() => setDraft(null)} noValidate className="grid gap-6">
      <FieldGroup>
        {fields.map((field) => {
          const error = state.fieldErrors[field.name];
          return (
            <Field key={field.name} data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                required
                value={values[field.name]}
                onChange={(event) => setDraft({ ...values, [field.name]: event.target.value })}
                aria-invalid={error ? true : undefined}
                className="w-28 tabular-nums"
              />
              <FieldDescription>{field.hint}</FieldDescription>
              {error ? <FieldError>{t(error)}</FieldError> : null}
            </Field>
          );
        })}
      </FieldGroup>
      <SubmitButton className="w-fit" disabled={!dirty}>
        {t("common.save")}
      </SubmitButton>
    </form>
  );
}
