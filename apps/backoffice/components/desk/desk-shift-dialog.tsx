"use client";

import { Trash2Icon } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDeskShift, saveDeskShift } from "@/app/(app)/planning/desk-actions";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { t } from "@/lib/i18n";

export type TeamOption = { id: string; name: string };
export type DeskShiftDraft = {
  id?: string | undefined;
  profileId?: string | undefined;
  date: string;
  start: string;
  end: string;
  note?: string | undefined;
};

/** Ajout ou modification d'une permanence à l'accueil (gérant) : personne, date, horaires. */
export function DeskShiftDialog({
  team,
  draft,
  trigger,
}: {
  team: TeamOption[];
  draft: DeskShiftDraft;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(draft.id);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveDeskShift({
        ...(draft.id ? { id: draft.id } : {}),
        profileId: String(formData.get("profileId") ?? ""),
        date: String(formData.get("date") ?? ""),
        start: String(formData.get("start") ?? ""),
        end: String(formData.get("end") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      if (result.error) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t(editing ? "desk.updated" : "desk.created"));
      setOpen(false);
    });
  }

  function remove() {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const result = await deleteDeskShift(id);
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else {
        toast.success(t("desk.deleted"));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(editing ? "desk.editTitle" : "desk.addTitle")}</DialogTitle>
          <DialogDescription>{t("desk.dialogHint")}</DialogDescription>
        </DialogHeader>
        <form action={submit} noValidate className="grid gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="desk-person">{t("desk.person")}</FieldLabel>
              <NativeSelect
                id="desk-person"
                name="profileId"
                defaultValue={draft.profileId ?? ""}
                required
              >
                <NativeSelectOption value="" disabled>
                  {t("desk.choosePerson")}
                </NativeSelectOption>
                {team.map((member) => (
                  <NativeSelectOption key={member.id} value={member.id}>
                    {member.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="desk-date">{t("desk.date")}</FieldLabel>
              <Input id="desk-date" name="date" type="date" defaultValue={draft.date} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="desk-start">{t("desk.start")}</FieldLabel>
                <Input
                  id="desk-start"
                  name="start"
                  type="time"
                  step={900}
                  defaultValue={draft.start}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="desk-end">{t("desk.end")}</FieldLabel>
                <Input
                  id="desk-end"
                  name="end"
                  type="time"
                  step={900}
                  defaultValue={draft.end}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="desk-note">{t("desk.note")}</FieldLabel>
              <Input id="desk-note" name="note" maxLength={200} defaultValue={draft.note ?? ""} />
            </Field>
          </FieldGroup>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={remove}
                disabled={pending}
              >
                <Trash2Icon data-icon="inline-start" />
                {t("desk.delete")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {t("desk.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
