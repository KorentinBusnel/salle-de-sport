"use client";

import { LABEL_MAX, MAX_OPTIONS, MEMBER_FIELD_TYPES, isChoiceField } from "@salle/shared";
import type { MemberFieldType } from "@salle/shared";
import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { TagInput } from "@/components/forms/tag-input";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type MessageKey, t } from "@/lib/i18n";

type Values = { label: string; type: MemberFieldType; options: string[] };

export type NewFieldState = {
  values: Values;
  fieldErrors: Partial<Record<keyof Values, MessageKey>>;
  error?: MessageKey | undefined;
  /** Champ créé : le dialogue se ferme et la nouvelle ligne prend le focus (`?n=<id>`). */
  createdId?: string | undefined;
};

export type NewFieldAction = (state: NewFieldState, formData: FormData) => Promise<NewFieldState>;

const EMPTY: NewFieldState = {
  values: { label: "", type: "text", options: [] },
  fieldErrors: {},
};

/**
 * « Nouveau champ » : libellé, type (immuable ensuite) et premières options d'une liste. À la
 * place d'une ligne « + Nouveau » : un champ ne se crée pas avec des valeurs par défaut.
 */
export function NewFieldDialog({ action }: { action: NewFieldAction }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" aria-hidden />
          {t("fields.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Remonté à chaque ouverture : le formulaire repart vide. */}
        {open ? <NewFieldForm action={action} onCreated={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewFieldForm({ action, onCreated }: { action: NewFieldAction; onCreated: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, formAction] = useActionState(
    async (previous: NewFieldState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.createdId) {
        toast.success(t("fields.created"));
        onCreated();
        // La section reste affichée ; la ligne créée prend le focus (FocusRow).
        const query = new URLSearchParams(params.toString());
        query.set("n", next.createdId);
        router.replace(`${pathname}?${query.toString()}`, { scroll: false });
      }
      return next;
    },
    EMPTY,
  );
  const [type, setType] = useState<MemberFieldType>(state.values.type);
  const { values, fieldErrors } = state;

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{t("fields.new")}</DialogTitle>
        <DialogDescription>{t("fields.newHint")}</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field data-invalid={fieldErrors.label ? true : undefined}>
          <FieldLabel htmlFor="new-field-label">{t("fields.label")}</FieldLabel>
          <Input
            id="new-field-label"
            name="label"
            defaultValue={values.label}
            maxLength={LABEL_MAX}
            placeholder={t("fields.labelPlaceholder")}
            autoFocus
            aria-invalid={fieldErrors.label ? true : undefined}
          />
          {fieldErrors.label ? <FieldError>{t(fieldErrors.label)}</FieldError> : null}
        </Field>

        <Field data-invalid={fieldErrors.type ? true : undefined}>
          <FieldLabel htmlFor="new-field-type">{t("fields.typeLabel")}</FieldLabel>
          <NativeSelect
            id="new-field-type"
            name="type"
            value={type}
            onChange={(event) => {
              const next = MEMBER_FIELD_TYPES.find((x) => x === event.target.value);
              if (next) setType(next);
            }}
            aria-invalid={fieldErrors.type ? true : undefined}
          >
            {MEMBER_FIELD_TYPES.map((x) => (
              <NativeSelectOption key={x} value={x}>
                {t(`fields.type.${x}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {fieldErrors.type ? <FieldError>{t(fieldErrors.type)}</FieldError> : null}
        </Field>

        {isChoiceField(type) ? (
          <Field data-invalid={fieldErrors.options ? true : undefined}>
            <FieldLabel htmlFor="new-field-options">{t("fields.options")}</FieldLabel>
            <TagInput
              id="new-field-options"
              name="options"
              defaultValue={values.options}
              max={MAX_OPTIONS}
              suggest={false}
              placeholder={t("fields.optionsPlaceholder")}
              invalid={Boolean(fieldErrors.options)}
              aria-describedby="new-field-options-hint"
            />
            <FieldDescription id="new-field-options-hint">
              {t("fields.optionsHint")}
            </FieldDescription>
            {fieldErrors.options ? <FieldError>{t(fieldErrors.options)}</FieldError> : null}
          </Field>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(state.error)}
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <SubmitButton>{t("fields.create")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
