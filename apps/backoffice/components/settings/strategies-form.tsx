"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type MessageKey, t } from "@/lib/i18n";

export type StrategiesValues = {
  late_booking_minutes: string;
  /** Vide : pointage possible à tout moment. */
  attendance_opens_minutes_before: string;
  allow_attendance_reset: boolean;
  manager_can_remove_credits: boolean;
  staff_can_suspend_members: boolean;
  staff_can_create_members: boolean;
};
export type StrategiesState = {
  values: StrategiesValues;
  fieldErrors: Partial<Record<keyof StrategiesValues, MessageKey>>;
};

const NUMBER_FIELDS = [
  {
    name: "late_booking_minutes",
    label: "strategies.lateBooking",
    hint: "strategies.lateBookingHint",
    max: 60,
  },
  {
    name: "attendance_opens_minutes_before",
    label: "strategies.attendanceOpens",
    hint: "strategies.attendanceOpensHint",
    max: 1440,
  },
] as const satisfies readonly {
  name: keyof StrategiesValues;
  label: MessageKey;
  hint: MessageKey;
  max: number;
}[];

const SWITCH_FIELDS = [
  {
    name: "allow_attendance_reset",
    label: "strategies.attendanceReset",
    hint: "strategies.attendanceResetHint",
  },
  {
    name: "manager_can_remove_credits",
    label: "strategies.removeCredits",
    hint: "strategies.removeCreditsHint",
  },
  {
    name: "staff_can_suspend_members",
    label: "strategies.staffSuspend",
    hint: "strategies.staffSuspendHint",
  },
  {
    name: "staff_can_create_members",
    label: "strategies.staffCreate",
    hint: "strategies.staffCreateHint",
  },
] as const satisfies readonly {
  name: keyof StrategiesValues;
  label: MessageKey;
  hint: MessageKey;
}[];

/** Stratégies de la salle : chaque règle dit ce qu'elle change ; tout est désactivé par défaut. */
export function StrategiesForm({
  initial,
  action,
}: {
  initial: StrategiesValues;
  action: (state: StrategiesState, formData: FormData) => Promise<StrategiesState>;
}) {
  const [state, formAction] = useActionState(action, { values: initial, fieldErrors: {} });
  const [draft, setDraft] = useState<StrategiesValues | null>(null);
  const values = draft ?? state.values;
  const dirty = (Object.keys(initial) as (keyof StrategiesValues)[]).some(
    (key) => values[key] !== initial[key],
  );

  return (
    <form action={formAction} onSubmit={() => setDraft(null)} noValidate className="grid gap-6">
      <FieldGroup>
        {NUMBER_FIELDS.map((field) => {
          const error = state.fieldErrors[field.name];
          return (
            <Field key={field.name} data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={field.name}>{t(field.label)}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                inputMode="numeric"
                min={0}
                max={field.max}
                value={values[field.name]}
                onChange={(event) => setDraft({ ...values, [field.name]: event.target.value })}
                aria-invalid={error ? true : undefined}
                className="w-28 tabular-nums"
              />
              <FieldDescription>{t(field.hint)}</FieldDescription>
              {error ? <FieldError>{t(error)}</FieldError> : null}
            </Field>
          );
        })}
        <FieldSeparator />
        {SWITCH_FIELDS.map((field) => (
          <Field key={field.name} orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={field.name}>{t(field.label)}</FieldLabel>
              <FieldDescription>{t(field.hint)}</FieldDescription>
            </FieldContent>
            <Switch
              id={field.name}
              name={field.name}
              checked={values[field.name]}
              onCheckedChange={(checked) => setDraft({ ...values, [field.name]: checked })}
            />
          </Field>
        ))}
      </FieldGroup>
      <SubmitButton className="w-fit" disabled={!dirty}>
        {t("common.save")}
      </SubmitButton>
    </form>
  );
}
