"use client";

import {
  MAX_OPTIONS,
  OPTION_LABEL_MAX,
  slugifyOptionValue,
  TONE_CLASSES,
  TONES,
  type MemberFieldOption,
  type Tone,
} from "@salle/shared";
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, useOptimistic, useRef, useState, useTransition } from "react";
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

function sameLabel(a: string, b: string): boolean {
  return a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;
}

/** Valeur libre d'une option : slug du libellé, puis `_2`, `_3`… si elle est déjà prise. */
function freeValue(label: string, taken: readonly string[]): string {
  const base = slugifyOptionValue(label) || "option";
  let candidate = base;
  for (let n = 2; taken.includes(candidate); n++) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  return candidate;
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
  /** Fiches par valeur d'option (member_field_usage). */
  counts: Record<string, number>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(options);
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberFieldOption | null>(null);
  const [draft, setDraft] = useState("");

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
    if (optimistic.some((option) => sameLabel(option.label, label))) {
      toast.error(t("fields.errors.duplicateOption"), { closeButton: true });
      return;
    }
    setDraft("");
    const value = freeValue(
      label,
      optimistic.map((option) => option.value),
    );
    save([...optimistic, { value, label, tone: "neutral" }], "fields.optionAdded");
  }

  function rename(value: string, text: string) {
    const label = cleanLabel(text);
    const current = optimistic.find((option) => option.value === value);
    if (!label || !current || label === current.label) return;
    if (optimistic.some((option) => option.value !== value && sameLabel(option.label, label))) {
      toast.error(t("fields.errors.duplicateOption"), { closeButton: true });
      return;
    }
    save(
      optimistic.map((option) => (option.value === value ? { ...option, label } : option)),
      "fields.optionsSaved",
    );
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
                onCancel={() => setRenaming(null)}
                onCommit={(text) => {
                  setRenaming(null);
                  rename(option.value, text);
                }}
              />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
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
                      if (counts[option.value]) setRemoving(option);
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
        {optimistic.length < MAX_OPTIONS ? (
          <li className="min-w-36 flex-1">
            <input
              type="text"
              value={draft}
              maxLength={OPTION_LABEL_MAX}
              disabled={pending}
              placeholder={t("fields.optionsPlaceholder")}
              aria-label={`${t("fields.addOption")} : ${name}`}
              onChange={(event) => setDraft(event.target.value)}
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
          </li>
        ) : null}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("fields.removeTitle", { name: removing?.label ?? "" })}
        description={t("fields.removeConfirm", {
          count: removing ? (counts[removing.value] ?? 0) : 0,
        })}
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
