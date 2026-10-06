"use client";

import { Trash2Icon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { deleteDeskShift, saveDeskShift } from "@/app/(app)/planning/desk-actions";
import { Combobox } from "@/components/forms/combobox";
import { DateField } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

export type TeamOption = { id: string; name: string };
export type DeskShiftDraft = {
  id?: string | undefined;
  profileId?: string | undefined;
  date: string;
  start: string;
  end: string;
  note?: string | undefined;
};

const OpenShift = createContext<((draft: DeskShiftDraft) => void) | null>(null);

/**
 * Un seul dialogue de permanence pour toute la page (gérant) : chaque créneau, trou ou « + »
 * l'ouvre avec son brouillon par `DeskShiftTrigger`.
 */
export function DeskShiftProvider({ team, children }: { team: TeamOption[]; children: ReactNode }) {
  const [draft, setDraft] = useState<DeskShiftDraft | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <OpenShift.Provider
      value={(next) => {
        setDraft(next);
        setOpen(true);
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {draft ? (
            // Clé : un autre brouillon repart de ses propres valeurs.
            <DeskShiftForm
              key={`${draft.id ?? "new"}-${draft.date}-${draft.start}`}
              team={team}
              draft={draft}
              onDone={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </OpenShift.Provider>
  );
}

/**
 * Bouton qui ouvre le dialogue avec ce brouillon : `Button` du kit, ou bouton natif (`native`)
 * pour les créneaux compacts du planning. Sans `DeskShiftProvider`, le bouton est inerte.
 */
export function DeskShiftTrigger({
  draft,
  native = false,
  ...props
}: ComponentProps<typeof Button> & { draft: DeskShiftDraft; native?: boolean | undefined }) {
  const open = useContext(OpenShift);
  const onClick = open ? () => open(draft) : undefined;
  if (native) {
    return (
      <button
        type="button"
        className={props.className}
        aria-label={props["aria-label"]}
        onClick={onClick}
      >
        {props.children}
      </button>
    );
  }
  return <Button type="button" {...props} onClick={onClick} />;
}

function DeskShiftForm({
  team,
  draft,
  onDone,
}: {
  team: TeamOption[];
  draft: DeskShiftDraft;
  onDone: () => void;
}) {
  const [profileId, setProfileId] = useState<string | null>(draft.profileId ?? null);
  const [date, setDate] = useState<string | null>(draft.date);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [note, setNote] = useState(draft.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { person: useId(), date: useId(), start: useId(), end: useId(), note: useId() };
  const editing = Boolean(draft.id);
  const nameOf = (id: string | undefined) => team.find((member) => member.id === id)?.name ?? "";

  function submit() {
    if (!profileId || !date) {
      setError(t(!profileId ? "desk.errors.person" : "desk.errors.date"));
      return;
    }
    startTransition(async () => {
      const result = await saveDeskShift({
        ...(draft.id ? { id: draft.id } : {}),
        profileId,
        date,
        start,
        end,
        note,
      });
      if (result.error) {
        setError(t(result.error));
        return;
      }
      toast.success(t(editing ? "desk.updated" : "desk.created"));
      onDone();
    });
  }

  function remove() {
    const { id, ...rest } = draft;
    if (!id || !rest.profileId) return;
    const restore = { ...rest, profileId: rest.profileId };
    onDone();
    // Réversible : « Annuler » recrée la même permanence.
    toastUndo({
      message: t("desk.deletedNamed", { name: nameOf(rest.profileId) }),
      mode: "inverse",
      run: () => deleteDeskShift(id),
      undo: () => saveDeskShift(restore),
    });
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(editing ? "desk.editTitle" : "desk.addTitle")}</DialogTitle>
        <DialogDescription>{t("desk.dialogHint")}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={ids.person}>{t("desk.person")}</FieldLabel>
          <Combobox
            id={ids.person}
            options={team.map((member) => ({
              value: member.id,
              label: member.name,
              person: true,
            }))}
            value={profileId}
            onChange={setProfileId}
            placeholder={t("desk.choosePerson")}
            invalid={error !== null && !profileId}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.date}>{t("desk.date")}</FieldLabel>
          <DateField
            id={ids.date}
            value={date}
            onChange={setDate}
            invalid={error !== null && !date}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={ids.start}>{t("desk.start")}</FieldLabel>
            <Input
              id={ids.start}
              type="time"
              step={900}
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.end}>{t("desk.end")}</FieldLabel>
            <Input
              id={ids.end}
              type="time"
              step={900}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={ids.note}>{t("desk.note")}</FieldLabel>
          <Input
            id={ids.note}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </FieldGroup>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter className="gap-2 sm:justify-between">
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={remove}
            disabled={pending}
          >
            <Trash2Icon data-icon="inline-start" aria-hidden />
            {t("desk.delete")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t("desk.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
