"use client";

import {
  MAX_OPTIONS,
  OPTION_LABEL_MAX,
  sameOptionLabel,
  TONE_CLASSES,
  TONES,
  uniqueOptionValue,
  type MemberFieldOption,
  type Tone,
} from "@salle/shared";
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateFieldOptions } from "@/app/(app)/parametres/champs-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill } from "@/components/status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Libellé nettoyé : espaces réduits, 40 caractères au plus. */
function cleanLabel(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, OPTION_LABEL_MAX);
}

/**
 * Options d'un champ liste : pastilles tonales, chacune avec un menu (renommer, ton, retirer) ;
 * ajout par Entrée. Chaque changement envoie la liste complète (update_member_field) ; la
 * valeur d'une option ne change jamais, seul son libellé ou son ton. Retirer une option
 * utilisée efface la valeur des fiches : confirmation demandée.
 */
export function FieldOptions({
  id,
  name,
  options,
  counts,
}: {
  id: string;
  /** Libellé du champ (noms accessibles). */
  name: string;
  options: MemberFieldOption[];
  /** Fiches par valeur d'option (member_field_usage) ; `null` : usage inconnu (toujours confirmer). */
  counts: Record<string, number> | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(options);
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);
  // Pastille à refocaliser après un renommage (Entrée ou Échap) : l'utilisateur clavier garde sa place.
  const [refocus, setRefocus] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberFieldOption | null>(null);
  const [draft, setDraft] = useState("");
  const hintId = useId();

  function save(next: MemberFieldOption[], message: MessageKey) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await updateFieldOptions({ id, options: next });
      if (!result.ok) toast.error(t(result.error), { closeButton: true });
      else toast.success(t(message));
    });
  }

  function add(text: string) {
    const label = cleanLabel(text);
    if (!label) return;
    if (optimistic.length >= MAX_OPTIONS) {
      toast.error(t("fields.errors.tooManyOptions"), { closeButton: true });
      return;
    }
    if (optimistic.some((option) => sameOptionLabel(option.label, label))) {
      toast.error(t("fields.errors.duplicateOption"), { closeButton: true });
      return;
    }
    setDraft("");
    const value = uniqueOptionValue(
      label,
      optimistic.map((option) => option.value),
    );
    save([...optimistic, { value, label, tone: "neutral" }], "fields.optionAdded");
  }

  /** Renomme une option ; faux si le libellé est déjà pris (la saisie reste ouverte). */
  function rename(value: string, text: string): boolean {
    const label = cleanLabel(text);
    const current = optimistic.find((option) => option.value === value);
    if (!label || !current || label === current.label) return true;
    if (
      optimistic.some((option) => option.value !== value && sameOptionLabel(option.label, label))
    ) {
      toast.error(t("fields.errors.duplicateOption"), { closeButton: true });
      return false;
    }
    save(
      optimistic.map((option) => (option.value === value ? { ...option, label } : option)),
      "fields.optionsSaved",
    );
    return true;
  }

  function setTone(value: string, tone: Tone) {
    save(
      optimistic.map((option) => (option.value === value ? { ...option, tone } : option)),
      "fields.optionsSaved",
    );
  }

  function remove(value: string) {
    save(
      optimistic.filter((option) => option.value !== value),
      "fields.optionsSaved",
    );
  }

  return (
    <div className={cn("grid gap-1", pending && "opacity-70")}>
      <ul
        className="flex flex-wrap items-center gap-1"
        aria-label={`${t("fields.options")} : ${name}`}
      >
        {optimistic.map((option) => (
          <li key={option.value} className="flex items-center">
            {renaming === option.value ? (
              <RenameInput
                label={t("fields.renameLabel", { name: option.label })}
                initial={option.label}
                onCancel={() => {
                  setRenaming(null);
                  setRefocus(option.value);
                }}
                onCommit={(text) => {
                  if (!rename(option.value, text)) return;
                  setRenaming(null);
                  setRefocus(option.value);
                }}
              />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    autoFocus={refocus === option.value}
                    onBlur={() => setRefocus(null)}
                    aria-label={t("fields.optionMenu", { name: option.label })}
                    className="flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-10"
                  >
                    <StatusPill tone={option.tone}>
                      {option.label}
                      <ChevronDownIcon aria-hidden className="size-3 opacity-60" />
                    </StatusPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                  <DropdownMenuItem onSelect={() => setRenaming(option.value)}>
                    <PencilIcon aria-hidden />
                    {t("fields.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("fields.toneLabel")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={option.tone}
                    onValueChange={(next) => {
                      const tone = TONES.find((x) => x === next);
                      if (tone && tone !== option.tone) setTone(option.value, tone);
                    }}
                  >
                    {TONES.map((tone) => (
                      <DropdownMenuRadioItem key={tone} value={tone}>
                        <span
                          aria-hidden
                          className={cn("size-2.5 rounded-full", TONE_CLASSES[tone].dot)}
                        />
                        {t(`fields.tone.${tone}`)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      // Usage inconnu : on confirme dans le doute.
                      if (counts === null || counts[option.value]) setRemoving(option);
                      else remove(option.value);
                    }}
                  >
                    <Trash2Icon aria-hidden />
                    {t("fields.remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
        {optimistic.length === 0 ? (
          <li className="px-2 text-xs text-muted-foreground">{t("fields.noOptions")}</li>
        ) : null}
        {optimistic.length < MAX_OPTIONS ? (
          <li className="min-w-36 flex-1">
            <input
              type="text"
              value={draft}
              maxLength={OPTION_LABEL_MAX}
              disabled={pending}
              placeholder={t("fields.optionsPlaceholder")}
              aria-label={`${t("fields.addOption")} : ${name}`}
              aria-describedby={hintId}
              onChange={(event) => setDraft(event.target.value)}
              // Un brouillon laissé en quittant le champ est ajouté, comme dans TagInput.
              onBlur={() => {
                if (draft.trim()) add(draft);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add(draft);
                } else if (event.key === "Escape" && draft) {
                  event.preventDefault();
                  setDraft("");
                }
              }}
              className="h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-xs transition-colors outline-none placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed pointer-coarse:h-10"
            />
            <span id={hintId} className="sr-only">
              {t("fields.addOptionHint")}
            </span>
          </li>
        ) : null}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("fields.removeTitle", { name: removing?.label ?? "" })}
        description={
          counts === null
            ? t("fields.removeConfirmUnknown")
            : t("fields.removeConfirm", { count: removing ? (counts[removing.value] ?? 0) : 0 })
        }
        confirmLabel={t("fields.remove")}
        action={() => {
          if (removing) remove(removing.value);
          setRemoving(null);
        }}
      />
    </div>
  );
}

/** Renommage sur place : Entrée ou sortie du champ enregistre, Échap annule. */
function RenameInput({
  label,
  initial,
  onCancel,
  onCommit,
}: {
  label: string;
  initial: string;
  onCancel: () => void;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const done = useRef(false);

  function finish() {
    if (done.current) return;
    done.current = true;
    onCommit(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish();
    } else if (event.key === "Escape") {
      event.preventDefault();
      done.current = true;
      onCancel();
    }
  }

  return (
    <input
      autoFocus
      type="text"
      aria-label={label}
      value={text}
      maxLength={OPTION_LABEL_MAX}
      onChange={(event) => setText(event.target.value)}
      onBlur={finish}
      onKeyDown={onKeyDown}
      className="h-7 w-40 rounded-full border border-ring bg-card px-2.5 text-xs outline-none ring-3 ring-ring/30 pointer-coarse:h-10"
    />
  );
}
