"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { type MovePreview, moveSession, previewMove } from "@/app/(app)/planning/move-actions";
import { DateField } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

const fromClock = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * « Déplacer… » au clavier depuis la fiche : nouvelle date et heure, aperçu (inscrits prévenus,
 * chevauchement du coach), puis confirmation. « Annuler » si personne n'a été prévenu.
 */
export function MoveSessionForm({
  sessionId,
  dayKey,
  time,
  timeZone,
}: {
  sessionId: string;
  /** Date et heure actuelles (« AAAA-MM-JJ », « HH:MM »), point de retour d'« Annuler ». */
  dayKey: string;
  time: string;
  timeZone: string;
}) {
  const [date, setDate] = useState<string | null>(dayKey);
  const [clock, setClock] = useState(time);
  const [preview, setPreview] = useState<Extract<MovePreview, { error: null }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = { date: useId(), time: useId() };
  const minutes = fromClock(clock);
  const original = fromClock(time) ?? 0;
  const unchanged = date === dayKey && minutes === original;

  function check() {
    if (!date || minutes === null) {
      setError(t("session.moveInvalid"));
      return;
    }
    startTransition(async () => {
      const result = await previewMove({ sessionId, dayKey: date, minutes });
      if (result.error) {
        setError(t(result.error));
        setPreview(null);
        return;
      }
      setError(null);
      setPreview(result);
    });
  }

  function move() {
    if (!preview || !date || minutes === null) return;
    const to = { sessionId, dayKey: date, minutes };
    const notified = preview.booked + preview.waitlisted;
    setPreview(null);
    if (notified === 0) {
      toastUndo({
        message: t("planning.moved"),
        mode: "inverse",
        run: () => moveSession(to),
        undo: () => moveSession({ sessionId, dayKey, minutes: original }),
      });
      return;
    }
    startTransition(async () => {
      const result = await moveSession(to);
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("planning.movedNotified", { count: notified }));
    });
  }

  const when = preview
    ? new Intl.DateTimeFormat("fr-FR", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(preview.startsAt))
    : "";
  const notified = preview ? preview.booked + preview.waitlisted : 0;

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (preview) move();
        else check();
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={ids.date} className="text-sm text-muted-foreground">
            {t("session.moveDate")}
          </label>
          <DateField
            id={ids.date}
            value={date}
            onChange={(value) => {
              setDate(value);
              setPreview(null);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={ids.time} className="text-sm text-muted-foreground">
            {t("session.moveTime")}
          </label>
          <Input
            id={ids.time}
            type="time"
            step={300}
            value={clock}
            onChange={(event) => {
              setClock(event.target.value);
              setPreview(null);
            }}
            className="tabular-nums"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div role="status" className="grid gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="font-medium">{t("session.moveTo", { when })}</p>
          <p className="text-muted-foreground">
            {notified > 0
              ? t("planning.moveNotified", { count: notified })
              : t("planning.moveNobody")}
          </p>
          {preview.coachConflict ? (
            <p className="flex items-start gap-2 text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("planning.moveCoachConflict")}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        {preview ? (
          <Button type="button" variant="ghost" onClick={() => setPreview(null)}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          type="submit"
          variant={preview ? "default" : "outline"}
          disabled={pending || unchanged}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {preview ? t("planning.moveConfirm") : t("session.moveCheck")}
        </Button>
      </div>
    </form>
  );
}
