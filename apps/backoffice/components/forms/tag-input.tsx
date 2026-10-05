"use client";

import { normalizeTags } from "@salle/shared";
import { PlusIcon, TagIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Chip } from "@/components/forms/combobox";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Suggestion = { tag: string; uses: number };

/** Étiquettes existantes de la salle (fonction SQL tag_suggestions), au fil de la frappe. */
function useTagSuggestions(query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const term = query.trim().toLowerCase();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/etiquettes?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) setSuggestions(((await response.json()) as { tags: Suggestion[] }).tags);
      } catch {
        // Requête annulée par une frappe plus récente.
      }
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, term]);
  return enabled ? suggestions : [];
}

/** Étiquette affichée (liste, fiche), avec un lien ou un bouton « Retirer » facultatif. */
export { Chip as TagChip };

/**
 * Saisie d'étiquettes (Watermelon combobox-10/11, tags) : pastilles retirables, Entrée ou
 * virgule pour ajouter, retour arrière pour retirer la dernière, collage « a, b, c »,
 * suggestions des étiquettes déjà utilisées (accueil et plus). Normalisées comme en base.
 */
export function TagInput({
  id,
  name,
  value,
  defaultValue = [],
  onChange,
  max = 20,
  suggest = true,
  disabled,
  invalid,
  placeholder,
  className,
  ...aria
}: {
  id?: string | undefined;
  /** Champ de formulaire : un champ caché par étiquette. */
  name?: string | undefined;
  value?: string[] | undefined;
  defaultValue?: string[] | undefined;
  onChange?: ((tags: string[]) => void) | undefined;
  max?: number | undefined;
  suggest?: boolean | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-describedby"?: string | undefined;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-suggestions`;
  const hintId = `${inputId}-hint`;
  const [inner, setInner] = useState(() => normalizeTags(defaultValue));
  const tags = value ?? inner;
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = useTagSuggestions(text, Boolean(suggest && focused && !disabled));
  const full = tags.length >= max;

  function commit(next: string[]) {
    const normalized = normalizeTags(next)
      .map((tag) => tag.slice(0, 40))
      .slice(0, max);
    setInner(normalized);
    onChange?.(normalized);
  }
  function add(raw: string) {
    const parts = raw.split(",").filter((part) => part.trim());
    if (parts.length) commit([...tags, ...parts]);
    setText("");
    setActive(0);
  }

  const typed = normalizeTags([text])[0];
  const choices = suggestions.filter((s) => !tags.includes(s.tag));
  // Première proposition : créer l'étiquette tapée si elle n'existe pas encore.
  const items: { tag: string; uses: number | null }[] = [
    ...(typed && !tags.includes(typed) && !choices.some((s) => s.tag === typed)
      ? [{ tag: typed, uses: null }]
      : []),
    ...choices,
  ];
  const open = focused && !full && items.length > 0;
  const current = Math.min(active, items.length - 1);

  return (
    <div className={cn("w-full", className)}>
      {name ? tags.map((tag) => <input key={tag} type="hidden" name={name} value={tag} />) : null}
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div
            aria-invalid={invalid || undefined}
            className={cn(
              "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent p-1 text-sm transition-colors pointer-coarse:min-h-10",
              "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
              "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onRemove={disabled ? undefined : () => commit(tags.filter((t) => t !== tag))}
              />
            ))}
            <input
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={open ? `${listId}-${current}` : undefined}
              autoComplete="off"
              value={text}
              onChange={(event) => {
                const next = event.target.value;
                if (next.includes(",")) add(next);
                else {
                  setText(next);
                  setActive(0);
                }
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                if (text.trim()) add(text);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && open) {
                  event.preventDefault();
                  setActive((current + 1) % items.length);
                } else if (event.key === "ArrowUp" && open) {
                  event.preventDefault();
                  setActive((current - 1 + items.length) % items.length);
                } else if (event.key === "Enter") {
                  const item = open ? items[current] : undefined;
                  if (item || text.trim()) {
                    event.preventDefault();
                    add(item ? item.tag : text);
                  }
                } else if (event.key === "Backspace" && !text && tags.length) {
                  commit(tags.slice(0, -1));
                } else if (event.key === "Escape" && text) {
                  event.preventDefault();
                  setText("");
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (pasted.includes(",")) {
                  event.preventDefault();
                  add(`${text}${pasted}`);
                }
              }}
              disabled={disabled || full}
              maxLength={40}
              placeholder={full ? undefined : (placeholder ?? t("forms.tagPlaceholder"))}
              aria-label={aria["aria-label"]}
              aria-describedby={[hintId, aria["aria-describedby"]].filter(Boolean).join(" ")}
              className="h-6 min-w-32 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed pointer-coarse:h-8"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popper-anchor-width) min-w-56 p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Le champ garde le focus pendant le clic sur une suggestion.
          onMouseDown={(event) => event.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label={t("forms.tagSuggestions")} className="grid">
            {items.map((item, index) => (
              <li
                key={item.tag}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                onClick={() => add(item.tag)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm pointer-coarse:py-2.5 [&_svg]:size-4 [&_svg]:text-muted-foreground",
                  index === current && "bg-muted",
                )}
              >
                {item.uses === null ? <PlusIcon aria-hidden /> : <TagIcon aria-hidden />}
                <span className="min-w-0 flex-1 truncate">
                  {item.uses === null ? t("forms.create", { query: item.tag }) : item.tag}
                </span>
                {item.uses !== null ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("forms.tagUses", { count: item.uses })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <p id={hintId} className="sr-only">
        {t("forms.tagHint")}
      </p>
    </div>
  );
}
