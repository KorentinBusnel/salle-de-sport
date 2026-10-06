"use client";

import { ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Titre du groupe (les options d'un même groupe se suivent). */
  group?: string | undefined;
  description?: string | undefined;
  /** Pastille de couleur (discipline, étape) : couleur CSS. */
  color?: string | undefined;
  /** Avatar à initiales (personne). */
  person?: boolean | undefined;
  /** Mots en plus pour la recherche (email, téléphone…). */
  keywords?: string[] | undefined;
  disabled?: boolean | undefined;
};

type Base = {
  id?: string | undefined;
  options: ComboboxOption[];
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  emptyText?: string | undefined;
  /** Nom du champ de formulaire (un champ caché par valeur). */
  name?: string | undefined;
  /** « Créer « … » » quand la recherche ne correspond à aucune option. */
  onCreate?: ((query: string) => void) | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-describedby"?: string | undefined;
};

type Single = Base & {
  multiple?: false | undefined;
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onChange?: ((value: string | null) => void) | undefined;
  /** Une valeur choisie peut être retirée (« Effacer »). */
  clearable?: boolean | undefined;
};

type Multiple = Base & {
  multiple: true;
  value?: string[] | undefined;
  defaultValue?: string[] | undefined;
  onChange?: ((value: string[]) => void) | undefined;
};

/** Recherche sans accents ni casse (« Ines » trouve « Inès »). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function filterOption(_value: string, search: string, keywords?: string[]): number {
  const needle = normalizeSearch(search);
  if (!needle) return 1;
  return normalizeSearch((keywords ?? []).join(" ")).includes(needle) ? 1 : 0;
}

function groupOptions(options: ComboboxOption[]) {
  const groups: { label: string | undefined; options: ComboboxOption[] }[] = [];
  for (const option of options) {
    const last = groups.at(-1);
    if (last && last.label === option.group) last.options.push(option);
    else groups.push({ label: option.group, options: [option] });
  }
  return groups;
}

export function OptionVisual({ option }: { option: ComboboxOption }) {
  if (option.person) {
    return (
      <Avatar className="size-6">
        <AvatarFallback className="text-[0.65rem]">{initials(option.label)}</AvatarFallback>
      </Avatar>
    );
  }
  if (option.color) {
    return (
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: option.color }}
      />
    );
  }
  return null;
}

/**
 * Liste déroulante avec recherche (Watermelon combobox-1/3/4/6/8/10, recomposée sur Radix +
 * cmdk) : choix simple ou multiple, groupes, pastille ou avatar, description, « Créer ».
 * Contrôlée (`value` + `onChange`) ou non (`defaultValue`, champ caché `name`).
 */
export function Combobox(props: Single | Multiple) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [inner, setInner] = useState<string[]>(() =>
    props.multiple ? (props.defaultValue ?? []) : props.defaultValue ? [props.defaultValue] : [],
  );
  const selected: string[] = props.multiple
    ? (props.value ?? inner)
    : props.value !== undefined
      ? props.value
        ? [props.value]
        : []
      : inner;
  const byValue = new Map(props.options.map((option) => [option.value, option]));

  function commit(next: string[]) {
    setInner(next);
    if (props.multiple) props.onChange?.(next);
    else props.onChange?.(next[0] ?? null);
  }

  function toggle(value: string) {
    if (props.multiple) {
      commit(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
      setSearch("");
    } else {
      commit(selected[0] === value && props.clearable ? [] : [value]);
      setOpen(false);
      setSearch("");
    }
  }

  const query = search.trim();
  const exact = props.options.some(
    (option) => normalizeSearch(option.label) === normalizeSearch(query),
  );
  const showCreate = Boolean(props.onCreate && query && !exact);
  const single = !props.multiple ? byValue.get(selected[0] ?? "") : undefined;

  const list = (
    <PopoverContent
      align="start"
      className="w-(--radix-popper-anchor-width) min-w-56 p-0"
      onOpenAutoFocus={(event) => {
        // Le champ de recherche prend le focus (cmdk), pas le premier élément.
        event.preventDefault();
        (event.currentTarget as HTMLElement).querySelector("input")?.focus();
      }}
    >
      <Command filter={filterOption}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={props.searchPlaceholder ?? t("forms.search")}
          aria-label={props.searchPlaceholder ?? t("forms.search")}
        />
        <CommandList>
          <CommandEmpty>{props.emptyText ?? t("forms.noOption")}</CommandEmpty>
          {groupOptions(props.options).map((group, index) => (
            <CommandGroup key={group.label ?? `group-${index}`} heading={group.label}>
              {group.options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? "", ...(option.keywords ?? [])]}
                  disabled={option.disabled ?? false}
                  data-checked={selected.includes(option.value)}
                  onSelect={() => toggle(option.value)}
                  className="gap-2 pointer-coarse:py-2.5"
                >
                  <OptionVisual option={option} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {showCreate ? (
            <>
              <CommandSeparator />
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__create__${query}`}
                  onSelect={() => {
                    props.onCreate?.(query);
                    setSearch("");
                    if (!props.multiple) setOpen(false);
                  }}
                  className="gap-2 pointer-coarse:py-2.5"
                >
                  <PlusIcon aria-hidden />
                  <span className="truncate">{t("forms.create", { query })}</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </PopoverContent>
  );

  const hidden = props.name
    ? (selected.length ? selected : [""]).map((value, index) => (
        <input key={`${value}-${index}`} type="hidden" name={props.name} value={value} />
      ))
    : null;

  const fieldClass = cn(
    "w-full rounded-lg border border-input bg-transparent text-sm transition-colors outline-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  if (!props.multiple) {
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        {hidden}
        <div className={cn("relative", props.className)}>
          <PopoverTrigger
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={props.invalid || undefined}
            aria-label={props["aria-label"]}
            aria-describedby={props["aria-describedby"]}
            disabled={props.disabled}
            className={cn(
              fieldClass,
              "flex h-8 items-center gap-2 px-2.5 text-left pointer-coarse:h-10",
              props.clearable && single && "pr-14",
            )}
          >
            {single ? (
              <>
                <OptionVisual option={single} />
                <span className="min-w-0 flex-1 truncate">{single.label}</span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {props.placeholder ?? t("forms.choose")}
              </span>
            )}
            <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          {props.clearable && single && !props.disabled ? (
            <button
              type="button"
              onClick={() => commit([])}
              aria-label={t("forms.clear")}
              className="absolute top-1/2 right-7 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>
        {list}
      </Popover>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      {hidden}
      <PopoverAnchor asChild>
        <div
          aria-invalid={props.invalid || undefined}
          className={cn(
            fieldClass,
            "flex min-h-8 flex-wrap items-center gap-1 p-1 pointer-coarse:min-h-10",
            "has-[[role=combobox]:focus-visible]:border-ring has-[[role=combobox]:focus-visible]:ring-3 has-[[role=combobox]:focus-visible]:ring-ring/50",
            props.className,
          )}
        >
          {selected.map((value) => {
            const option = byValue.get(value);
            const label = option?.label ?? value;
            return (
              <Chip
                key={value}
                onRemove={props.disabled ? undefined : () => toggle(value)}
                label={label}
              >
                {option ? <OptionVisual option={option} /> : null}
              </Chip>
            );
          })}
          <PopoverTrigger
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={props["aria-label"]}
            aria-describedby={props["aria-describedby"]}
            disabled={props.disabled}
            className="flex h-6 min-w-8 flex-1 items-center justify-between gap-2 rounded-md px-1.5 text-left text-muted-foreground outline-none pointer-coarse:h-8"
          >
            {selected.length ? (
              <span className="sr-only">{t("forms.selected", { count: selected.length })}</span>
            ) : (
              <span className="truncate">{props.placeholder ?? t("forms.choose")}</span>
            )}
            <ChevronsUpDownIcon aria-hidden className="ml-auto size-4 shrink-0" />
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      {list}
    </Popover>
  );
}

/** Pastille retirable (choix multiple, étiquettes). */
export function Chip({
  label,
  onRemove,
  children,
  className,
}: {
  label: string;
  onRemove?: (() => void) | undefined;
  children?: ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-muted pr-0.5 pl-2 text-xs font-medium text-foreground pointer-coarse:h-8",
        !onRemove && "pr-2",
        className,
      )}
    >
      {children}
      <span className="truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("forms.remove", { label })}
          className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:size-7"
        >
          <XIcon aria-hidden className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
