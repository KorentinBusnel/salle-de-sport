"use client";

import { disciplineColors } from "@salle/ui";
import { CheckIcon, ChevronDownIcon, PencilIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type CellValue = string | number | boolean | string[] | null;
export type CellOption = { value: string; label: string; hint?: string | undefined };
export type CellScope = "one" | "following";
export type CellSave = (input: {
  id: string;
  field: string;
  value: CellValue;
  scope?: CellScope | undefined;
}) => Promise<{ error: MessageKey | null; message?: MessageKey | undefined; count?: number }>;

type Common = {
  /** Identifiant de la ligne (séance, cours, discipline…) transmis à l'action. */
  id: string;
  field: string;
  /** Nom accessible : « Durée », « Coachs »… */
  label: string;
  action: CellSave;
  /** Séance issue d'un cours récurrent : demander « cette séance » ou « et les suivantes ». */
  askScope?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
};

type Props = Common &
  (
    | { kind: "text"; value: string; placeholder?: string | undefined; maxLength?: number }
    | {
        kind: "number";
        value: number;
        unit?: string | undefined;
        min: number;
        max: number;
        step?: number | undefined;
      }
    | { kind: "time"; value: string }
    | { kind: "date"; value: string | null; clearable?: boolean | undefined }
    | { kind: "color"; value: string }
    | { kind: "switch"; value: boolean }
    | {
        kind: "select";
        value: string | null;
        options: CellOption[];
        clearable?: boolean | undefined;
      }
    | { kind: "multi"; value: string[]; options: CellOption[] }
  );

/**
 * Cellule éditable « à la Notion » : un clic (ou Entrée) pour modifier, Entrée ou sortie du
 * champ pour enregistrer, Échap pour annuler. Enregistrement optimiste par Server Action ;
 * en cas de refus (règle SQL), la valeur revient et un toast explique pourquoi.
 */
export function EditableCell(props: Props) {
  const [optimistic, setOptimistic] = useOptimistic<CellValue>(props.value);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [scopeFor, setScopeFor] = useState<CellValue | undefined>(undefined);

  function commit(value: CellValue, scope?: CellScope) {
    setEditing(false);
    if (JSON.stringify(value) === JSON.stringify(props.value)) return;
    if (props.askScope && !scope) {
      setScopeFor(value);
      return;
    }
    startTransition(async () => {
      setOptimistic(value);
      const result = await props.action({ id: props.id, field: props.field, value, scope });
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else if (result.message)
        toast.success(t(result.message, result.count !== undefined ? { count: result.count } : {}));
    });
  }

  const display = renderValue(props, optimistic);
  const triggerClass = cn(
    "group/cell flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors pointer-coarse:min-h-10",
    props.disabled
      ? "cursor-default"
      : "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    pending && "opacity-70",
    props.className,
  );
  const ariaLabel = `${props.label} : ${typeof display === "string" ? display || t("inline.empty") : ""}${props.disabled ? "" : `, ${t("inline.edit")}`}`;

  const scopeDialog = (
    <AlertDialog
      open={scopeFor !== undefined}
      onOpenChange={(open) => !open && setScopeFor(undefined)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("inline.scopeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("inline.scopeBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              const value = scopeFor ?? null;
              setScopeFor(undefined);
              commit(value, "one");
            }}
          >
            {t("inline.scopeOne")}
          </Button>
          <Button
            onClick={() => {
              const value = scopeFor ?? null;
              setScopeFor(undefined);
              commit(value, "following");
            }}
          >
            {t("inline.scopeFollowing")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (props.kind === "switch") {
    return (
      <>
        <Switch
          checked={optimistic === true}
          disabled={props.disabled || pending}
          aria-label={props.label}
          onCheckedChange={(checked) => commit(checked)}
        />
        {scopeDialog}
      </>
    );
  }

  if (props.disabled) {
    return <span className={triggerClass}>{display}</span>;
  }

  // Champs saisis au clavier : texte, nombre, heure, date.
  if (
    props.kind === "text" ||
    props.kind === "number" ||
    props.kind === "time" ||
    props.kind === "date"
  ) {
    if (editing) {
      return (
        <InlineInput
          {...props}
          initial={optimistic}
          onCancel={() => setEditing(false)}
          onCommit={commit}
        />
      );
    }
    return (
      <>
        <button
          type="button"
          className={triggerClass}
          aria-label={ariaLabel}
          onClick={() => setEditing(true)}
        >
          {display}
          <PencilIcon
            aria-hidden
            className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100"
          />
        </button>
        {scopeDialog}
      </>
    );
  }

  // Listes : couleur, choix simple, choix multiple (Popover).
  return (
    <>
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass} aria-label={ariaLabel}>
            {display}
            <ChevronDownIcon
              aria-hidden
              className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          {props.kind === "color" ? (
            <div className="grid grid-cols-6 gap-2 p-3" role="listbox" aria-label={props.label}>
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="option"
                  aria-selected={optimistic === color}
                  aria-label={color}
                  onClick={() => commit(color)}
                  className="flex size-8 items-center justify-center rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  style={{ backgroundColor: color }}
                >
                  {optimistic === color ? <CheckIcon className="size-4 text-white" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <OptionList
              label={props.label}
              options={props.options}
              multiple={props.kind === "multi"}
              clearable={props.kind === "select" ? (props.clearable ?? false) : false}
              initial={
                props.kind === "multi"
                  ? (optimistic as string[])
                  : optimistic === null
                    ? []
                    : [String(optimistic)]
              }
              onCommit={(values) => commit(props.kind === "multi" ? values : (values[0] ?? null))}
            />
          )}
        </PopoverContent>
      </Popover>
      {scopeDialog}
    </>
  );
}

const PALETTE = [
  ...Object.values(disciplineColors),
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#475569",
  "#0d9488",
  "#9333ea",
] as const;

function renderValue(props: Props, value: CellValue): ReactNode {
  switch (props.kind) {
    case "number":
      return (
        <span className="tabular-nums">
          {String(value)}
          {props.unit ? ` ${props.unit}` : ""}
        </span>
      );
    case "color":
      return (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3.5 rounded-full"
            style={{ backgroundColor: String(value) }}
          />
          <span className="font-mono text-xs text-muted-foreground">{String(value)}</span>
        </span>
      );
    case "select": {
      const option = props.options.find((o) => o.value === value);
      return option ? (
        option.label
      ) : (
        <span className="text-muted-foreground">{t("inline.none")}</span>
      );
    }
    case "multi": {
      const values = (value as string[]) ?? [];
      if (!values.length) return <span className="text-muted-foreground">{t("inline.none")}</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
              {props.options.find((o) => o.value === v)?.label ?? "?"}
            </span>
          ))}
        </span>
      );
    }
    case "date":
      return value ? (
        String(value)
      ) : (
        <span className="text-muted-foreground">{t("inline.none")}</span>
      );
    default:
      return value === "" || value === null ? (
        <span className="text-muted-foreground">{t("inline.empty")}</span>
      ) : (
        String(value)
      );
  }
}

function InlineInput({
  initial,
  onCancel,
  onCommit,
  ...props
}: Props & { initial: CellValue; onCancel: () => void; onCommit: (value: CellValue) => void }) {
  const [text, setText] = useState(initial === null ? "" : String(initial));
  const done = useRef(false);

  function finish() {
    if (done.current) return;
    done.current = true;
    if (props.kind === "number") {
      const value = Number(text.replace(",", "."));
      if (!Number.isFinite(value) || value < props.min || value > props.max) {
        toast.error(t("inline.outOfRange", { min: props.min, max: props.max }), {
          closeButton: true,
        });
        onCancel();
        return;
      }
      onCommit(Math.round(value));
      return;
    }
    if (props.kind === "date") {
      onCommit(text === "" ? null : text);
      return;
    }
    if (props.kind === "text" && text.trim() === "") {
      onCancel();
      return;
    }
    onCommit(props.kind === "text" ? text.trim() : text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish();
    } else if (event.key === "Escape") {
      done.current = true;
      onCancel();
    }
  }

  return (
    <input
      autoFocus
      aria-label={props.label}
      type={props.kind === "text" ? "text" : props.kind}
      inputMode={props.kind === "number" ? "numeric" : undefined}
      min={props.kind === "number" ? props.min : undefined}
      max={props.kind === "number" ? props.max : undefined}
      step={props.kind === "number" ? (props.step ?? 1) : props.kind === "time" ? 300 : undefined}
      maxLength={props.kind === "text" ? (props.maxLength ?? 120) : undefined}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={finish}
      onKeyDown={onKeyDown}
      className="h-8 w-full min-w-0 rounded-md border border-ring bg-card px-2 text-sm tabular-nums outline-none ring-3 ring-ring/30 pointer-coarse:h-10"
    />
  );
}

function OptionList({
  label,
  options,
  multiple,
  clearable,
  initial,
  onCommit,
}: {
  label: string;
  options: CellOption[];
  multiple: boolean;
  clearable: boolean;
  initial: string[];
  onCommit: (values: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <Command>
      <CommandInput placeholder={t("inline.search")} aria-label={label} />
      <CommandList>
        <CommandEmpty>{t("inline.noResult")}</CommandEmpty>
        <CommandGroup>
          {clearable ? (
            <CommandItem value="__none" onSelect={() => onCommit([])}>
              <span className="text-muted-foreground">{t("inline.none")}</span>
            </CommandItem>
          ) : null}
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                onSelect={() => {
                  if (!multiple) return onCommit([option.value]);
                  setSelected((current) =>
                    checked
                      ? current.filter((v) => v !== option.value)
                      : [...current, option.value],
                  );
                }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded-sm border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {checked ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className="flex-1">{option.label}</span>
                {option.hint ? (
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      {multiple ? (
        <div className="flex justify-end gap-2 border-t p-2">
          <Button size="sm" onClick={() => onCommit(selected)}>
            {t("inline.apply")}
          </Button>
        </div>
      ) : null}
    </Command>
  );
}
