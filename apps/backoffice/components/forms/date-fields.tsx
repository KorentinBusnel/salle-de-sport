"use client";

import { dateRangePreset, monthRange, type DateRangePreset } from "@salle/shared";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
 * Champs de date (Watermelon date-picker-2/3/10/11/12, calendar-25), recomposés sur Popover +
 * Calendar. Les valeurs sont des dates civiles du fuseau de la salle : « AAAA-MM-JJ » (jour),
 * « AAAA-MM » (mois), « AAAA-MM-JJTHH:MM » (date et heure, converties côté serveur par
 * zonedInstant). Aucune conversion de fuseau dans le navigateur.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** « AAAA-MM-JJ » → date locale à minuit (pour le calendrier, qui raisonne en jours locaux). */
export function keyToDate(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const civilLong = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const civilShort = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const civilMedium = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthLong = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const monthShort = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short" });

const atNoon = (key: string) => new Date(`${key}T12:00:00Z`);
export const formatDateKey = (key: string) => civilLong.format(atNoon(key));
const formatMonthKey = (key: string) => {
  const text = monthLong.format(atNoon(`${key}-01`));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Valeur contrôlée (`value`) ou interne (`defaultValue`). */
function useFieldValue<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState<T>(defaultValue);
  const current = value !== undefined ? value : inner;
  return [
    current,
    (next: T) => {
      setInner(next);
      onChange?.(next);
    },
  ] as const;
}

type FieldProps = {
  id?: string | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-describedby"?: string | undefined;
};

const triggerClass = cn(
  "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none pointer-coarse:h-10",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function Trigger({
  id,
  label,
  placeholder,
  open,
  props,
  clear,
}: {
  id: string;
  label: string | null;
  placeholder: string;
  open: boolean;
  props: FieldProps;
  clear?: (() => void) | undefined;
}) {
  return (
    <div className={cn("relative", props.className)}>
      <PopoverTrigger
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={props.invalid || undefined}
        aria-label={props["aria-label"]}
        aria-describedby={props["aria-describedby"]}
        disabled={props.disabled}
        className={cn(triggerClass, clear && label && "pr-9")}
      >
        <CalendarIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span
          className={cn("min-w-0 flex-1 truncate tabular-nums", !label && "text-muted-foreground")}
        >
          {label ?? placeholder}
        </span>
      </PopoverTrigger>
      {clear && label && !props.disabled ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("forms.clear")}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Props facultatives du calendrier (mois affiché, bornes), omises plutôt que `undefined`. */
function calendarExtras(month: Date | undefined, min?: string, max?: string) {
  const before = min ? keyToDate(min) : undefined;
  const after = max ? keyToDate(max) : undefined;
  const disabled = [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
  return {
    ...(month ? { defaultMonth: month } : {}),
    ...(disabled.length ? { disabled } : {}),
  };
}

/** Jour (« AAAA-MM-JJ »). */
export function DateField({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  clearable = false,
  ...props
}: FieldProps & {
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onChange?: ((value: string | null) => void) | undefined;
  min?: string | undefined;
  max?: string | undefined;
  clearable?: boolean | undefined;
}) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const [current, set] = useFieldValue(value, defaultValue, onChange);
  const selected = current ? keyToDate(current) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {props.name ? <input type="hidden" name={props.name} value={current ?? ""} /> : null}
      <Trigger
        id={props.id ?? generatedId}
        label={current ? formatDateKey(current) : null}
        placeholder={props.placeholder ?? t("forms.pickDate")}
        open={open}
        props={props}
        clear={clearable ? () => set(null) : undefined}
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          {...calendarExtras(selected, min, max)}
          onSelect={(date) => {
            if (!date) return;
            set(dateToKey(date));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export type DateRangeValue = { from: string; to: string };

const PRESETS: DateRangePreset[] = [
  "last7",
  "last30",
  "thisMonth",
  "lastMonth",
  "last90",
  "thisYear",
];

/** Période (bornes incluses), avec raccourcis relatifs au jour de la salle. */
export function DateRangeField({
  value,
  defaultValue = null,
  onChange,
  todayKey,
  presets = PRESETS,
  nameFrom,
  nameTo,
  min,
  max,
  ...props
}: Omit<FieldProps, "name"> & {
  value?: DateRangeValue | null | undefined;
  defaultValue?: DateRangeValue | null | undefined;
  onChange?: ((value: DateRangeValue | null) => void) | undefined;
  /** Jour de la salle (« AAAA-MM-JJ ») pour les raccourcis. */
  todayKey: string;
  presets?: DateRangePreset[] | undefined;
  nameFrom?: string | undefined;
  nameTo?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
}) {
  const generatedId = useId();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [current, set] = useFieldValue(value, defaultValue, onChange);
  // Sélection en cours (premier clic posé) : validée au second clic seulement.
  const [draft, setDraft] = useState<{ from: Date; to?: Date | undefined } | undefined>();
  const selected =
    draft ?? (current ? { from: keyToDate(current.from)!, to: keyToDate(current.to) } : undefined);
  const label = current
    ? current.from === current.to
      ? formatDateKey(current.from)
      : t("forms.rangeFrom", {
          from: civilShort.format(atNoon(current.from)),
          to: civilMedium.format(atNoon(current.to)),
        })
    : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
      }}
    >
      {nameFrom ? <input type="hidden" name={nameFrom} value={current?.from ?? ""} /> : null}
      {nameTo ? <input type="hidden" name={nameTo} value={current?.to ?? ""} /> : null}
      <Trigger
        id={props.id ?? generatedId}
        label={label}
        placeholder={props.placeholder ?? t("forms.pickRange")}
        open={open}
        props={props}
      />
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          {presets.length ? (
            <div
              role="group"
              aria-label={t("forms.presets")}
              className="flex gap-1 overflow-x-auto border-b p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0"
            >
              {presets.map((preset) => {
                const range = dateRangePreset(preset, todayKey);
                const active = current?.from === range.from && current.to === range.to;
                return (
                  <Button
                    key={preset}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={active}
                    className="shrink-0 justify-start"
                    onClick={() => {
                      set(range);
                      setDraft(undefined);
                      setOpen(false);
                    }}
                  >
                    {t(`forms.preset.${preset}`)}
                  </Button>
                );
              })}
            </div>
          ) : null}
          <Calendar
            mode="range"
            numberOfMonths={mobile ? 1 : 2}
            selected={selected}
            {...calendarExtras(selected?.from, min, max)}
            onSelect={(_range, day) => {
              if (!draft) {
                setDraft({ from: day });
                return;
              }
              const [from, to] = day < draft.from ? [day, draft.from] : [draft.from, day];
              set({ from: dateToKey(from), to: dateToKey(to) });
              setDraft(undefined);
              setOpen(false);
            }}
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Date et heure murales (« AAAA-MM-JJTHH:MM »), dans le fuseau de la salle. */
export function DateTimeField({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  step = 300,
  ...props
}: FieldProps & {
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onChange?: ((value: string | null) => void) | undefined;
  min?: string | undefined;
  max?: string | undefined;
  /** Pas des minutes, en secondes (5 min par défaut). */
  step?: number | undefined;
}) {
  const generatedId = useId();
  const [current, set] = useFieldValue(value, defaultValue, onChange);
  const day = current?.slice(0, 10) ?? null;
  const time = current?.slice(11, 16) ?? "";
  return (
    <div className={cn("flex gap-2", props.className)}>
      {props.name ? <input type="hidden" name={props.name} value={current ?? ""} /> : null}
      <DateField
        id={props.id ?? generatedId}
        value={day}
        onChange={(next) => set(next ? `${next}T${time || "09:00"}` : null)}
        min={min}
        max={max}
        disabled={props.disabled}
        invalid={props.invalid}
        aria-label={props["aria-label"]}
        aria-describedby={props["aria-describedby"]}
        className="min-w-0 flex-1"
      />
      <Input
        type="time"
        value={time}
        step={step}
        disabled={props.disabled || !day}
        aria-invalid={props.invalid || undefined}
        aria-label={t("forms.time")}
        onChange={(event) => set(day && event.target.value ? `${day}T${event.target.value}` : null)}
        className="w-28 tabular-nums"
      />
    </div>
  );
}

/** Mois (« AAAA-MM ») : année puis grille des douze mois (Watermelon calendar-25). */
export function MonthPicker({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  ...props
}: FieldProps & {
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onChange?: ((value: string | null) => void) | undefined;
  min?: string | undefined;
  max?: string | undefined;
}) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const [current, set] = useFieldValue(value, defaultValue, onChange);
  const [year, setYear] = useState(() => Number((current ?? max ?? "2026-01").slice(0, 4)));
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && current) setYear(Number(current.slice(0, 4)));
      }}
    >
      {props.name ? <input type="hidden" name={props.name} value={current ?? ""} /> : null}
      <Trigger
        id={props.id ?? generatedId}
        label={current && monthRange(current) ? formatMonthKey(current) : null}
        placeholder={props.placeholder ?? t("forms.pickMonth")}
        open={open}
        props={props}
      />
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between">
          <YearButton
            label={t("forms.previousYear")}
            disabled={year - 1 < minYear}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeftIcon aria-hidden />
          </YearButton>
          <span className="text-sm font-medium tabular-nums" aria-live="polite">
            {year}
          </span>
          <YearButton
            label={t("forms.nextYear")}
            disabled={year + 1 > maxYear}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRightIcon aria-hidden />
          </YearButton>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {months.map((key) => {
            const outside = (min !== undefined && key < min) || (max !== undefined && key > max);
            const active = key === current;
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                disabled={outside}
                aria-pressed={active}
                aria-label={formatMonthKey(key)}
                onClick={() => {
                  set(key);
                  setOpen(false);
                }}
                className="capitalize"
              >
                {monthShort.format(atNoon(`${key}-01`)).replace(".", "")}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function YearButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
