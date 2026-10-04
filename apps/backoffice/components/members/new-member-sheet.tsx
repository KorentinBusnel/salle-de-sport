"use client";

import { MEMBER_STATUS_TONE, type MemberStatus } from "@salle/shared";
import { TriangleAlertIcon, UserPlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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

type Values = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: "prospect" | "active";
};
export type NewMemberState = {
  values: Values;
  fieldErrors: Partial<Record<keyof Values, MessageKey>>;
  duplicates: { id: string; name: string; contact: string; status: MemberStatus }[];
  error?: MessageKey | undefined;
};

const EMPTY: NewMemberState = {
  values: { first_name: "", last_name: "", email: "", phone: "", status: "prospect" },
  fieldErrors: {},
  duplicates: [],
};

/** Création d'une fiche : panneau latéral, doublons signalés avant de confirmer. */
export function NewMemberSheet({
  action,
}: {
  action: (state: NewMemberState, formData: FormData) => Promise<NewMemberState>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <UserPlusIcon data-icon="inline-start" />
          {t("members.new.button")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {/* Remonté à chaque ouverture : le formulaire repart vide. */}
        {open ? <NewMemberForm action={action} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function NewMemberForm({
  action,
}: {
  action: (state: NewMemberState, formData: FormData) => Promise<NewMemberState>;
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const { values, fieldErrors, duplicates } = state;
  const text = [
    { name: "first_name", label: "members.new.firstName", autoComplete: "given-name" },
    { name: "last_name", label: "members.new.lastName", autoComplete: "family-name" },
    { name: "email", label: "members.new.email", autoComplete: "email", type: "email" },
    { name: "phone", label: "members.new.phone", autoComplete: "tel", type: "tel" },
  ] as const;

  return (
    <form action={formAction} noValidate className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>{t("members.new.title")}</SheetTitle>
        <SheetDescription>{t("members.new.hint")}</SheetDescription>
      </SheetHeader>

      <FieldGroup className="flex-1 px-4">
        {text.map((field) => {
          const error = fieldErrors[field.name];
          return (
            <Field key={field.name} data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`new-${field.name}`}>{t(field.label)}</FieldLabel>
              <Input
                id={`new-${field.name}`}
                name={field.name}
                type={"type" in field ? field.type : "text"}
                autoComplete={field.autoComplete}
                defaultValue={values[field.name]}
                aria-invalid={error ? true : undefined}
              />
              {error ? <FieldError>{t(error)}</FieldError> : null}
            </Field>
          );
        })}
        <Field>
          <FieldLabel htmlFor="new-status">{t("members.new.status")}</FieldLabel>
          <NativeSelect id="new-status" name="status" defaultValue={values.status}>
            <NativeSelectOption value="prospect">{t("memberStatus.prospect")}</NativeSelectOption>
            <NativeSelectOption value="active">{t("memberStatus.active")}</NativeSelectOption>
          </NativeSelect>
        </Field>

        {duplicates.length > 0 ? (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>{t("members.new.duplicatesTitle")}</AlertTitle>
            <AlertDescription>
              <ul className="my-2 grid w-full gap-2">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="block font-medium text-foreground">{d.name}</span>
                      <span className="block text-xs">{d.contact}</span>
                    </span>
                    <StatusPill tone={MEMBER_STATUS_TONE[d.status]}>
                      {t(`memberStatus.${d.status}`)}
                    </StatusPill>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-foreground">
                <Checkbox name="force" />
                {t("members.new.force")}
              </label>
            </AlertDescription>
          </Alert>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(state.error)}
          </p>
        ) : null}
      </FieldGroup>

      <SheetFooter>
        <SubmitButton>{t("members.new.submit")}</SubmitButton>
      </SheetFooter>
    </form>
  );
}
