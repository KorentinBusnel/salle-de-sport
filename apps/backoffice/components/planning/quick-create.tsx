"use client";

import { CalendarPlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSessionAt } from "@/app/(app)/planning/move-actions";
import { Combobox, type ComboboxOption } from "@/components/forms/combobox";
import { DateField } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

export type CreateOptions = {
  disciplines: ComboboxOption[];
  coaches: ComboboxOption[];
  rooms: ComboboxOption[];
};

const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const fromClock = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * Création rapide d'une séance ponctuelle (gérant) : discipline, heure, coachs, salle. Durée et
 * places reprennent les valeurs de la discipline (modifiables ensuite sur la fiche).
 */
export function QuickCreateForm({
  options,
  dayKey,
  minutes,
  withDate = false,
  onDone,
}: {
  options: CreateOptions;
  dayKey: string;
  minutes: number;
  /** Date modifiable (création hors grille). */
  withDate?: boolean | undefined;
  onDone: () => void;
}) {
  const [disciplineId, setDisciplineId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(dayKey);
  const [time, setTime] = useState(toClock(minutes));
  const [coachIds, setCoachIds] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = {
    discipline: useId(),
    date: useId(),
    time: useId(),
    coaches: useId(),
    room: useId(),
  };

  function submit() {
    const at = fromClock(time);
    if (!disciplineId || !date || at === null) {
      setError(t(!disciplineId ? "planning.quick.needDiscipline" : "planning.quick.needWhen"));
      return;
    }
    startTransition(async () => {
      const result = await createSessionAt({
        dayKey: date,
        minutes: at,
        disciplineId,
        coachIds,
        roomId,
      });
      if (result.error) {
        setError(t(result.error));
        return;
      }
      toast.success(t("planning.created"));
      onDone();
    });
  }

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor={ids.discipline}>{t("templates.discipline")}</FieldLabel>
          <Combobox
            id={ids.discipline}
            options={options.disciplines}
            value={disciplineId}
            onChange={setDisciplineId}
            placeholder={t("forms.choose")}
            invalid={error !== null && !disciplineId}
          />
        </Field>
        <div className={withDate ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]" : "grid"}>
          {withDate ? (
            <Field>
              <FieldLabel htmlFor={ids.date}>{t("desk.date")}</FieldLabel>
              <DateField id={ids.date} value={date} onChange={setDate} />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor={ids.time}>{t("planning.quick.time")}</FieldLabel>
            <Input
              id={ids.time}
              type="time"
              step={300}
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="w-32 tabular-nums"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={ids.coaches}>{t("planning.quick.coaches")}</FieldLabel>
          <Combobox
            id={ids.coaches}
            multiple
            options={options.coaches}
            value={coachIds}
            onChange={setCoachIds}
            placeholder={t("planning.quick.noCoach")}
          />
        </Field>
        {options.rooms.length ? (
          <Field>
            <FieldLabel htmlFor={ids.room}>{t("planning.quick.room")}</FieldLabel>
            <Combobox
              id={ids.room}
              options={options.rooms}
              value={roomId}
              onChange={setRoomId}
              clearable
              placeholder={t("planning.quick.noRoom")}
            />
          </Field>
        ) : null}
      </FieldGroup>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t("planning.createConfirm")}
        </Button>
      </div>
    </form>
  );
}

const longDay = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Titre de la création rapide : « Nouvelle séance · mardi 6 octobre ». */
export function quickCreateTitle(dayKey: string) {
  return t("planning.quick.title", { day: longDay.format(new Date(`${dayKey}T12:00:00Z`)) });
}

/**
 * « Nouvelle séance » hors grille : bouton de l'en-tête, vue jour et « + Nouveau › Séance »
 * (ouvert d'emblée avec `?creer=1`, paramètre retiré à la fermeture).
 */
export function QuickCreateDialog({
  options,
  dayKey,
  minutes,
  defaultOpen = false,
}: {
  options: CreateOptions;
  dayKey: string;
  minutes: number;
  defaultOpen?: boolean | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(next: boolean) {
    setOpen(next);
    if (!next && params.has("creer")) {
      const query = new URLSearchParams(params.toString());
      query.delete("creer");
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlusIcon data-icon="inline-start" aria-hidden />
          {t("planning.quick.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("planning.quick.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("planning.createHint")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <QuickCreateForm
            options={options}
            dayKey={dayKey}
            minutes={minutes}
            withDate
            onDone={() => change(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
