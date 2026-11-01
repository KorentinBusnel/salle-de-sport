"use client";

import {
  FIELD_OPS_BY_TYPE,
  filtersToPairs,
  hasFilters,
  NO_FILTERS_PARAM,
  optionLabel,
  parseSegmentFilters,
  TEXT_MAX,
  type FieldCondition,
  type FieldOp,
  type MemberField,
  type SegmentFilters,
} from "@salle/shared";
import { PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { DateField } from "@/components/forms/date-fields";
import { TagInput } from "@/components/forms/tag-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useUrlState } from "@/hooks/use-url-state";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;

/** Filtres « simples » (une clé de segmentFiltersSchema chacun). */
const SIMPLE_KINDS = [
  "statuses",
  "tags",
  "inactive_days",
  "discipline_id",
  "max_credits",
  "joined_since",
  "birthday_month",
  "email_consent",
] as const;
type SimpleKind = (typeof SIMPLE_KINDS)[number];
const KIND_LABEL: Record<SimpleKind, MessageKey> = {
  statuses: "filters.statuses",
  tags: "filters.tags",
  inactive_days: "filters.inactiveDays",
  discipline_id: "filters.disciplineId",
  max_credits: "filters.maxCredits",
  joined_since: "filters.joinedSince",
  birthday_month: "filters.birthdayMonth",
  email_consent: "filters.emailConsent",
};
/** Filtres sans valeur à saisir : ajoutés d'un clic. */
const FLAG_KINDS: SimpleKind[] = ["birthday_month", "email_consent"];

/** Ce que l'on édite : un filtre simple, ou une condition de champ (nouvelle si `index` absent). */
type Editing = { kind: SimpleKind } | { kind: "field"; key: string; index?: number | undefined };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
function dateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return y && m && d ? dateFormat.format(new Date(Date.UTC(y, m - 1, d))) : key;
}

/**
 * Barre de filtres (puces + « Ajouter un filtre »), commune aux vues d'adhérents et aux segments.
 * Chaque changement réécrit toutes les clés de filtre dans l'URL (`useUrlState().set`, qui garde
 * `vue`, `segment`, `q` et remet `page` à zéro) ; le marqueur « aucun filtre » distingue une vue
 * ou un segment dont on a tout retiré. Les règles (clés, opérateurs) viennent de `@salle/shared`.
 */
export function FilterBar({
  filters,
  baseFilters,
  disciplines,
  fields,
  className,
}: {
  filters: SegmentFilters;
  /** Filtres de la vue ou du segment ouvert : si on les retire tous, l'URL le dit (`f0`). */
  baseFilters: SegmentFilters;
  disciplines: { id: string; name: string }[];
  fields: MemberField[];
  className?: string | undefined;
}) {
  const { set } = useUrlState();
  const [editing, setEditing] = useState<Editing | null>(null);

  function apply(next: SegmentFilters) {
    const clean = parseSegmentFilters(next);
    const changes: Record<string, string | null> = Object.fromEntries([
      ...[
        "statuses",
        "tags",
        "inactive_days",
        "discipline_id",
        "max_credits",
        "joined_since",
        "birthday_month",
        "email_consent",
        "f",
        "statut",
        "tag",
        NO_FILTERS_PARAM,
      ].map((key) => [key, null]),
      ...filtersToPairs(clean),
    ]);
    if (!hasFilters(clean) && hasFilters(baseFilters)) changes[NO_FILTERS_PARAM] = "1";
    setEditing(null);
    set(changes);
  }

  function patch<K extends keyof SegmentFilters>(key: K, value: SegmentFilters[K] | undefined) {
    const next = { ...filters };
    if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
    apply(next);
  }

  function setCondition(index: number | undefined, condition: FieldCondition | null) {
    const list = [...(filters.fields ?? [])];
    if (index === undefined) {
      if (condition) list.push(condition);
    } else if (condition) list[index] = condition;
    else list.splice(index, 1);
    patch("fields", list);
  }

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const disciplineName = (id: string) => disciplines.find((d) => d.id === id)?.name ?? "";

  // Puces : un filtre simple par clé, une par condition de champ.
  const chips: {
    id: string;
    editing: Editing;
    label: string;
    value: string;
    onRemove: () => void;
  }[] = [];
  if (filters.statuses?.length)
    chips.push({
      id: "statuses",
      editing: { kind: "statuses" },
      label: t("filters.statuses"),
      value: filters.statuses.map((s) => t(`memberStatus.${s}`)).join(", "),
      onRemove: () => patch("statuses", undefined),
    });
  if (filters.tags?.length)
    chips.push({
      id: "tags",
      editing: { kind: "tags" },
      label: t("filters.tags"),
      value: filters.tags.join(", "),
      onRemove: () => patch("tags", undefined),
    });
  if (filters.inactive_days !== undefined)
    chips.push({
      id: "inactive_days",
      editing: { kind: "inactive_days" },
      label: t("filters.inactiveDays"),
      value: t("filters.days", { count: filters.inactive_days }),
      onRemove: () => patch("inactive_days", undefined),
    });
  if (filters.discipline_id)
    chips.push({
      id: "discipline_id",
      editing: { kind: "discipline_id" },
      label: t("filters.disciplineId"),
      value: disciplineName(filters.discipline_id),
      onRemove: () => patch("discipline_id", undefined),
    });
  if (filters.max_credits !== undefined)
    chips.push({
      id: "max_credits",
      editing: { kind: "max_credits" },
      label: t("filters.maxCredits"),
      value: t("filters.credits", { count: filters.max_credits }),
      onRemove: () => patch("max_credits", undefined),
    });
  if (filters.joined_since)
    chips.push({
      id: "joined_since",
      editing: { kind: "joined_since" },
      label: t("filters.joinedSince"),
      value: dateLabel(filters.joined_since),
      onRemove: () => patch("joined_since", undefined),
    });
  if (filters.birthday_month)
    chips.push({
      id: "birthday_month",
      editing: { kind: "birthday_month" },
      label: t("filters.birthdayMonth"),
      value: "",
      onRemove: () => patch("birthday_month", undefined),
    });
  if (filters.email_consent)
    chips.push({
      id: "email_consent",
      editing: { kind: "email_consent" },
      label: t("filters.emailConsent"),
      value: "",
      onRemove: () => patch("email_consent", undefined),
    });
  (filters.fields ?? []).forEach((condition, index) => {
    const field = fieldByKey.get(condition.key);
    chips.push({
      id: `field-${index}`,
      editing: { kind: "field", key: condition.key, index },
      label: field?.label ?? condition.key,
      value: conditionText(condition, field),
      onRemove: () => setCondition(index, null),
    });
  });

  const available = SIMPLE_KINDS.filter((kind) => filters[kind] === undefined);
  const draftChip =
    editing && !chips.some((chip) => sameEditing(chip.editing, editing)) ? editing : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          value={chip.value}
          open={editing !== null && sameEditing(chip.editing, editing)}
          onOpenChange={(open) => setEditing(open ? chip.editing : null)}
          onRemove={chip.onRemove}
          editable={!FLAG_KINDS.includes(chip.editing.kind as SimpleKind)}
        >
          <Editor
            editing={chip.editing}
            filters={filters}
            fields={fields}
            disciplines={disciplines}
            onApply={patch}
            onCondition={setCondition}
            onCancel={() => setEditing(null)}
          />
        </FilterChip>
      ))}
      {draftChip ? (
        <FilterChip
          label={
            draftChip.kind === "field"
              ? (fieldByKey.get(draftChip.key)?.label ?? draftChip.key)
              : t(KIND_LABEL[draftChip.kind])
          }
          value="…"
          open
          onOpenChange={(open) => !open && setEditing(null)}
          editable
        >
          <Editor
            editing={draftChip}
            filters={filters}
            fields={fields}
            disciplines={disciplines}
            onApply={patch}
            onCondition={setCondition}
            onCancel={() => setEditing(null)}
          />
        </FilterChip>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t("filters.add")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {available.map((kind) => (
            <DropdownMenuItem
              key={kind}
              onSelect={() => {
                if (kind === "birthday_month" || kind === "email_consent") patch(kind, true);
                else setEditing({ kind });
              }}
            >
              {t(KIND_LABEL[kind])}
            </DropdownMenuItem>
          ))}
          {fields.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("filters.fieldsGroup")}</DropdownMenuLabel>
                {fields.map((field) => (
                  <DropdownMenuItem
                    key={field.id}
                    onSelect={() => setEditing({ kind: "field", key: field.key })}
                  >
                    {field.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {chips.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => apply({})}
        >
          {t("filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}

function sameEditing(a: Editing, b: Editing): boolean {
  if (a.kind === "field" || b.kind === "field")
    return a.kind === "field" && b.kind === "field" && a.key === b.key && a.index === b.index;
  return a.kind === b.kind;
}

/** Texte d'une condition de champ (« est Compétition », « contient x », « est vide »). */
function conditionText(condition: FieldCondition, field: MemberField | undefined): string {
  const op = t(`filters.op.${condition.op}`);
  if (condition.op === "is_empty" || condition.op === "is_not_empty") return op;
  const value = condition.value;
  const show = (v: string | number | boolean): string => {
    if (typeof v === "boolean") return v ? t("filters.yes") : t("filters.no");
    if (typeof v === "number") return String(v);
    if (field && (field.type === "select" || field.type === "multi_select"))
      return optionLabel(field, v);
    if (field?.type === "date") return dateLabel(v);
    return v;
  };
  if (Array.isArray(value)) return `${op} ${value.map(show).join(", ")}`;
  return `${op} ${show(value)}`;
}

/** Puce d'un filtre : son texte ouvre l'éditeur, la croix le retire. */
function FilterChip({
  label,
  value,
  open,
  onOpenChange,
  onRemove,
  editable,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove?: (() => void) | undefined;
  editable: boolean;
  children: ReactNode;
}) {
  const text = value ? `${label} : ${value}` : label;
  const body = (
    <span className="max-w-72 truncate">
      <span className="text-muted-foreground">{label}</span>
      {value ? <span className="ml-1 font-medium">{value}</span> : null}
    </span>
  );
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-muted pl-2.5 text-xs transition-colors has-[button:hover]:bg-accent pointer-coarse:h-10">
      {editable ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("filters.edit", { name: text })}
              className="flex h-full items-center rounded-l-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {body}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-3"
            // Les éditeurs ouvrent leurs propres surfaces (liste déroulante, calendrier) dans un
            // portail : ni le focus qui y passe, ni un clic dedans ne doivent fermer l'éditeur.
            onFocusOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.target as HTMLElement | null;
              if (
                target?.closest(
                  '[data-slot="popover-content"], [data-radix-popper-content-wrapper]',
                )
              )
                event.preventDefault();
            }}
          >
            {children}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="flex h-full items-center">{body}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          aria-label={t("filters.remove", { name: text })}
          onClick={onRemove}
          className="flex h-full items-center rounded-r-full px-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      ) : (
        <span className="w-2.5" />
      )}
    </span>
  );
}

/** Éditeur d'un filtre, selon sa nature. */
function Editor({
  editing,
  filters,
  fields,
  disciplines,
  onApply,
  onCondition,
  onCancel,
}: {
  editing: Editing;
  filters: SegmentFilters;
  fields: MemberField[];
  disciplines: { id: string; name: string }[];
  onApply: <K extends keyof SegmentFilters>(key: K, value: SegmentFilters[K] | undefined) => void;
  onCondition: (index: number | undefined, condition: FieldCondition | null) => void;
  onCancel: () => void;
}) {
  const id = useId();
  if (editing.kind === "statuses") {
    const current = filters.statuses ?? [];
    return (
      <div className="grid gap-2">
        {STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-2 text-sm pointer-coarse:min-h-10">
            <Checkbox
              checked={current.includes(status)}
              onCheckedChange={(checked) =>
                onApply(
                  "statuses",
                  checked ? [...current, status] : current.filter((s) => s !== status),
                )
              }
            />
            {t(`memberStatus.${status}`)}
          </label>
        ))}
      </div>
    );
  }
  if (editing.kind === "tags") {
    return (
      <TagInput
        aria-label={t("filters.tags")}
        value={filters.tags ?? []}
        onChange={(tags) => onApply("tags", tags)}
        placeholder={t("segments.tagsPlaceholder")}
      />
    );
  }
  if (editing.kind === "inactive_days" || editing.kind === "max_credits") {
    const max = editing.kind === "inactive_days" ? 365 : 100;
    const min = editing.kind === "inactive_days" ? 1 : 0;
    return (
      <NumberEditor
        id={id}
        label={t(KIND_LABEL[editing.kind])}
        initial={filters[editing.kind]}
        min={min}
        max={max}
        onApply={(value) => onApply(editing.kind, value)}
        onCancel={onCancel}
      />
    );
  }
  if (editing.kind === "discipline_id") {
    return (
      <Combobox
        aria-label={t("filters.disciplineId")}
        options={disciplines.map((d) => ({ value: d.id, label: d.name }))}
        value={filters.discipline_id ?? null}
        onChange={(value) => onApply("discipline_id", value ?? undefined)}
        placeholder={t("segments.any")}
      />
    );
  }
  if (editing.kind === "joined_since") {
    return (
      <DateField
        aria-label={t("filters.joinedSince")}
        value={filters.joined_since ?? null}
        onChange={(value) => onApply("joined_since", value ?? undefined)}
      />
    );
  }
  if (editing.kind === "field") {
    const field = fields.find((f) => f.key === editing.key);
    if (!field) return null;
    const current = editing.index !== undefined ? filters.fields?.[editing.index] : undefined;
    return (
      <ConditionEditor
        id={id}
        field={field}
        initial={current}
        onApply={(condition) => onCondition(editing.index, condition)}
        onCancel={onCancel}
      />
    );
  }
  return null;
}

function NumberEditor({
  id,
  label,
  initial,
  min,
  max,
  onApply,
  onCancel,
}: {
  id: string;
  label: string;
  initial: number | undefined;
  min: number;
  max: number;
  onApply: (value: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial === undefined ? "" : String(initial));
  const value = Number.parseInt(text, 10);
  const valid = Number.isFinite(value) && value >= min && value <= max;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onApply(value);
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-28 tabular-nums"
        />
      </Field>
      <EditorButtons disabled={!valid} onCancel={onCancel} />
    </form>
  );
}

/** Condition sur un champ personnalisé : opérateur puis valeur, selon le type du champ. */
function ConditionEditor({
  id,
  field,
  initial,
  onApply,
  onCancel,
}: {
  id: string;
  field: MemberField;
  initial: FieldCondition | undefined;
  onApply: (condition: FieldCondition) => void;
  onCancel: () => void;
}) {
  const ops = FIELD_OPS_BY_TYPE[field.type];
  const [op, setOp] = useState<FieldOp>(initial?.op ?? ops[0] ?? "is");
  const initialValue = initial && "value" in initial ? initial.value : undefined;
  const [text, setText] = useState(
    typeof initialValue === "string" || typeof initialValue === "number"
      ? String(initialValue)
      : "",
  );
  const [bool, setBool] = useState(initialValue === true);
  const [list, setList] = useState<string[]>(Array.isArray(initialValue) ? initialValue : []);
  const [choice, setChoice] = useState<string | null>(
    typeof initialValue === "string" ? initialValue : null,
  );

  const needsValue = op !== "is_empty" && op !== "is_not_empty";
  function build(): FieldCondition | null {
    if (!needsValue) return { key: field.key, op } as FieldCondition;
    switch (field.type) {
      case "boolean":
        return op === "is" ? { key: field.key, op, value: bool } : null;
      case "number": {
        const value = Number(text.replace(",", "."));
        if (!Number.isFinite(value)) return null;
        return op === "gte" || op === "lte" || op === "is" || op === "is_not"
          ? ({ key: field.key, op, value } as FieldCondition)
          : null;
      }
      case "date":
        return /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? ({ key: field.key, op, value: text } as FieldCondition)
          : null;
      case "select":
        return choice ? ({ key: field.key, op, value: choice } as FieldCondition) : null;
      case "multi_select":
        return op === "has_any" && list.length ? { key: field.key, op, value: list } : null;
      default: {
        const value = text.trim();
        return value ? ({ key: field.key, op, value } as FieldCondition) : null;
      }
    }
  }
  const condition = build();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (condition) onApply(condition);
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-op`}>{t("filters.operator")}</FieldLabel>
        <NativeSelect
          id={`${id}-op`}
          value={op}
          onChange={(event) => setOp(event.target.value as FieldOp)}
        >
          {ops.map((candidate) => (
            <NativeSelectOption key={candidate} value={candidate}>
              {t(`filters.op.${candidate}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {needsValue ? (
        <Field>
          <FieldLabel htmlFor={`${id}-value`}>{t("filters.value")}</FieldLabel>
          {field.type === "boolean" ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={bool} onCheckedChange={setBool} id={`${id}-value`} />
              {bool ? t("filters.yes") : t("filters.no")}
            </label>
          ) : field.type === "select" ? (
            <Combobox
              id={`${id}-value`}
              options={field.options.map((o) => ({ value: o.value, label: o.label, tone: o.tone }))}
              value={choice}
              onChange={setChoice}
            />
          ) : field.type === "multi_select" ? (
            <Combobox
              id={`${id}-value`}
              multiple
              options={field.options.map((o) => ({ value: o.value, label: o.label, tone: o.tone }))}
              value={list}
              onChange={setList}
            />
          ) : field.type === "date" ? (
            <DateField
              id={`${id}-value`}
              value={text || null}
              onChange={(value) => setText(value ?? "")}
            />
          ) : (
            <Input
              id={`${id}-value`}
              autoFocus
              type={field.type === "number" ? "text" : "text"}
              inputMode={field.type === "number" ? "decimal" : undefined}
              maxLength={TEXT_MAX}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={field.type === "number" ? "w-32 tabular-nums" : undefined}
            />
          )}
        </Field>
      ) : null}
      <EditorButtons disabled={!condition} onCancel={onCancel} />
    </form>
  );
}

function EditorButtons({ disabled, onCancel }: { disabled: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {t("filters.cancel")}
      </Button>
      <Button type="submit" size="sm" disabled={disabled}>
        {t("filters.apply")}
      </Button>
    </div>
  );
}
