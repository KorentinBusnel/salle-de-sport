"use client";

import { NotebookPenIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCareNote } from "@/app/(app)/adherents/[id]/actions";
import { TextareaWithCount } from "@/components/forms/textarea-with-count";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/**
 * Note « à savoir » modifiée sans quitter l'accueil (accueil et gérant). Vide = supprimée.
 * Le contenu reste dans l'équipe : jamais transmis à l'assistant.
 */
export function CareNotePopover({
  memberId,
  name,
  note,
}: {
  memberId: string;
  name: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const [pending, start] = useTransition();
  const fieldId = useId();

  function save(value: string) {
    start(async () => {
      const result = await updateCareNote({ memberId, note: value });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      if (result.message) toast.success(t(result.message));
      setOpen(false);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Chaque ouverture repart de la note enregistrée.
        if (next) setDraft(note);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t(note ? "today.careNoteEdit" : "today.careNoteAdd", { name })}
        >
          <NotebookPenIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save(draft);
          }}
        >
          <div className="grid gap-1">
            <label htmlFor={fieldId} className="text-sm font-medium">
              {t("today.careNoteTitle", { name })}
            </label>
            <p className="text-xs text-muted-foreground">{t("memberProfile.careNoteHint")}</p>
          </div>
          <TextareaWithCount
            id={fieldId}
            maxLength={500}
            rows={3}
            value={draft}
            placeholder={t("memberProfile.careNotePlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            {note ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={pending}
                onClick={() => save("")}
              >
                {t("today.careNoteClear")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={pending || draft.trim() === note.trim()}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("desk.save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
