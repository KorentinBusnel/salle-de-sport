"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { type MessageKey, t } from "@/lib/i18n";

export type TemplateFormState = {
  fieldErrors: Partial<Record<TemplateField, MessageKey>>;
  values: Partial<Record<TemplateField, string>>;
  error?: MessageKey;
};
export type TemplateField =
  | "discipline_id"
  | "default_coach_id"
  | "room_id"
  | "weekday"
  | "start_time"
  | "duration_minutes"
  | "capacity"
  | "starts_on"
  | "ends_on";

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** Création d'un cours récurrent dans un panneau latéral, erreurs affichées champ par champ. */
export function TemplateForm({
  action,
  disciplines,
  coaches,
  rooms,
  today,
}: {
  action: (state: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  disciplines: { id: string; name: string; color: string }[];
  coaches: { id: string; display_name: string }[];
  rooms: { id: string; name: string; capacity: number | null }[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, { fieldErrors: {}, values: {} });
  const [open, setOpen] = useState(false);
  // Après un envoi refusé, le panneau reste ouvert sur les erreurs jusqu'à fermeture.
  const [dismissed, setDismissed] = useState<TemplateFormState | null>(null);
  const showErrors = Object.keys(state.fieldErrors).length > 0 || Boolean(state.error);
  const v = state.values;
  const err = (field: TemplateField) => state.fieldErrors[field];
  const invalid = (field: TemplateField) => (err(field) ? true : undefined);
  const errorFor = (field: TemplateField) =>
    err(field) ? <FieldError>{t(err(field) as MessageKey)}</FieldError> : null;
  // Le formulaire est remonté à chaque nouvel état pour reprendre les valeurs saisies.
  const formKey = JSON.stringify(state.values);

  return (
    <Sheet
      open={open || (showErrors && dismissed !== state)}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDismissed(state);
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          {t("templates.create")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form key={formKey} action={formAction} noValidate className="flex min-h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t("templates.create")}</SheetTitle>
            <SheetDescription>{t("templates.createHint")}</SheetDescription>
          </SheetHeader>
          <FieldGroup className="flex-1 px-4">
            {state.error ? (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {t(state.error)}
              </p>
            ) : null}
            <Field data-invalid={invalid("discipline_id")}>
              <FieldLabel htmlFor="discipline_id">{t("templates.discipline")}</FieldLabel>
              <Select name="discipline_id" defaultValue={v.discipline_id ?? ""} required>
                <SelectTrigger
                  id="discipline_id"
                  aria-invalid={invalid("discipline_id")}
                  className="w-full"
                >
                  <SelectValue placeholder={t("templates.chooseDiscipline")} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errorFor("discipline_id")}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={invalid("weekday")}>
                <FieldLabel htmlFor="weekday">{t("templates.weekday")}</FieldLabel>
                <NativeSelect
                  id="weekday"
                  name="weekday"
                  defaultValue={v.weekday ?? "1"}
                  className="w-full"
                >
                  {WEEKDAYS.map((day) => (
                    <NativeSelectOption key={day} value={day}>
                      {t(`weekdays.${day}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errorFor("weekday")}
              </Field>
              <Field data-invalid={invalid("start_time")}>
                <FieldLabel htmlFor="start_time">{t("templates.startTime")}</FieldLabel>
                <Input
                  id="start_time"
                  name="start_time"
                  type="time"
                  defaultValue={v.start_time ?? "18:30"}
                  aria-invalid={invalid("start_time")}
                  required
                />
                {errorFor("start_time")}
              </Field>
              <Field data-invalid={invalid("duration_minutes")}>
                <FieldLabel htmlFor="duration_minutes">{t("templates.duration")}</FieldLabel>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={240}
                  defaultValue={v.duration_minutes ?? "60"}
                  aria-invalid={invalid("duration_minutes")}
                  required
                />
                {errorFor("duration_minutes")}
              </Field>
              <Field data-invalid={invalid("capacity")}>
                <FieldLabel htmlFor="capacity">{t("templates.capacity")}</FieldLabel>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  defaultValue={v.capacity ?? "16"}
                  aria-invalid={invalid("capacity")}
                  required
                />
                {errorFor("capacity")}
              </Field>
              <Field data-invalid={invalid("default_coach_id")}>
                <FieldLabel htmlFor="default_coach_id">{t("templates.coach")}</FieldLabel>
                <NativeSelect
                  id="default_coach_id"
                  name="default_coach_id"
                  defaultValue={v.default_coach_id ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">{t("templates.noCoach")}</NativeSelectOption>
                  {coaches.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.display_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={invalid("room_id")}>
                <FieldLabel htmlFor="room_id">{t("templates.room")}</FieldLabel>
                <NativeSelect
                  id="room_id"
                  name="room_id"
                  defaultValue={v.room_id ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">{t("templates.noRoom")}</NativeSelectOption>
                  {rooms.map((r) => (
                    <NativeSelectOption key={r.id} value={r.id}>
                      {r.capacity
                        ? t("templates.roomWithCapacity", { name: r.name, capacity: r.capacity })
                        : r.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={invalid("starts_on")}>
                <FieldLabel htmlFor="starts_on">{t("templates.startsOn")}</FieldLabel>
                <Input
                  id="starts_on"
                  name="starts_on"
                  type="date"
                  defaultValue={v.starts_on ?? today}
                  aria-invalid={invalid("starts_on")}
                  required
                />
                {errorFor("starts_on")}
              </Field>
              <Field data-invalid={invalid("ends_on")}>
                <FieldLabel htmlFor="ends_on">{t("templates.endsOn")}</FieldLabel>
                <Input
                  id="ends_on"
                  name="ends_on"
                  type="date"
                  defaultValue={v.ends_on ?? ""}
                  aria-invalid={invalid("ends_on")}
                />
                {errorFor("ends_on")}
              </Field>
            </div>
          </FieldGroup>
          <SheetFooter>
            <SubmitButton>{t("templates.createSubmit")}</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
