"use client";

import { clockToMinutes, type OpeningSlot, WEEKDAY_KEYS, type WeekdayKey } from "@salle/shared";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type WeeklySlots = Partial<Record<WeekdayKey, OpeningSlot[]>>;

const MAX_SLOTS = 3;
const WEEKDAYS: WeekdayKey[] = ["1", "2", "3", "4", "5"];

/** Erreur d'une plage : fin avant le début, ou chevauchement de la précédente. */
export function slotError(slots: OpeningSlot[], index: number): "order" | "overlap" | null {
  const slot = slots[index];
  if (!slot) return null;
  if (clockToMinutes(slot.end) <= clockToMinutes(slot.start)) return "order";
  const previous = slots[index - 1];
  if (previous && clockToMinutes(slot.start) < clockToMinutes(previous.end)) return "overlap";
  return null;
}

export function isValidWeek(value: WeeklySlots): boolean {
  return WEEKDAY_KEYS.every((day) =>
    (value[day] ?? []).every((_, index, slots) => slotError(slots, index) === null),
  );
}

/**
 * Plages horaires par jour de la semaine (Watermelon slot-picker) : un interrupteur
 * ouvert / fermé, jusqu'à trois plages, copie vers les autres jours. Contrôlé ; `onCommit`
 * reçoit chaque modification terminée (bascule, ajout, retrait, sortie d'un champ d'heure).
 */
export function WeeklySlotsEditor({
  value,
  onCommit,
  defaultSlot = { start: "09:00", end: "20:00" },
  disabled = false,
}: {
  value: WeeklySlots;
  /** Semaine valide (plages ordonnées, sans chevauchement) après chaque modification. */
  onCommit: (next: WeeklySlots) => void;
  defaultSlot?: OpeningSlot | undefined;
  disabled?: boolean | undefined;
}) {
  // Saisie en cours dans un champ d'heure : enregistrée à la sortie du champ.
  const [draft, setDraft] = useState<WeeklySlots | null>(null);
  const week = draft ?? value;

  function set(day: WeekdayKey, slots: OpeningSlot[], commit: boolean) {
    const next = { ...week, [day]: slots };
    // Une semaine invalide reste affichée avec ses erreurs, sans être transmise.
    if (commit && isValidWeek(next)) {
      setDraft(null);
      onCommit(next);
    } else setDraft(next);
  }

  return (
    <ul className="divide-y">
      {WEEKDAY_KEYS.map((day) => {
        const slots = week[day] ?? [];
        const open = slots.length > 0;
        const dayLabel = t(`weekdays.${day}`);
        const previousOpen = [...WEEKDAY_KEYS]
          .slice(0, WEEKDAY_KEYS.indexOf(day))
          .reverse()
          .map((d) => week[d] ?? [])
          .find((s) => s.length > 0);
        return (
          <li
            key={day}
            className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="flex h-8 items-center gap-3 pointer-coarse:h-10">
              <Switch
                checked={open}
                disabled={disabled}
                aria-label={t("settings.hours.dayOpen", { day: dayLabel })}
                onCheckedChange={(checked) =>
                  set(day, checked ? [...(previousOpen ?? [defaultSlot])] : [], true)
                }
              />
              <span className="text-sm font-medium">{dayLabel}</span>
            </div>

            {open ? (
              <div className="grid gap-2">
                {slots.map((slot, index) => {
                  const error = slotError(slots, index);
                  const errorId = `slot-${day}-${index}-error`;
                  const update = (field: "start" | "end", time: string, commit: boolean) =>
                    set(
                      day,
                      slots.map((s, i) => (i === index ? { ...s, [field]: time } : s)),
                      commit,
                    );
                  return (
                    <div key={index} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {(["start", "end"] as const).map((field) => (
                          <Input
                            key={field}
                            type="time"
                            step={300}
                            value={slot[field]}
                            disabled={disabled}
                            aria-label={`${dayLabel} : ${t(field === "start" ? "settings.hours.from" : "settings.hours.to")}`}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            onChange={(event) => update(field, event.target.value, false)}
                            onBlur={(event) => {
                              if (event.target.value) update(field, event.target.value, true);
                            }}
                            className="w-32 tabular-nums"
                          />
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={disabled}
                          aria-label={t("settings.hours.removeSlot", {
                            from: slot.start,
                            to: slot.end,
                          })}
                          onClick={() =>
                            set(
                              day,
                              slots.filter((_, i) => i !== index),
                              true,
                            )
                          }
                        >
                          <XIcon aria-hidden />
                        </Button>
                      </div>
                      {error ? (
                        <p id={errorId} className="text-xs text-destructive">
                          {t(`settings.hours.errors.${error}`)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex h-8 items-center text-sm text-muted-foreground pointer-coarse:h-10">
                {t("settings.hours.closed")}
              </p>
            )}

            <div className={cn("flex gap-1", !open && "invisible")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || slots.length >= MAX_SLOTS}
                onClick={() => {
                  const last = slots.at(-1);
                  const start = last ? last.end : defaultSlot.start;
                  const startMinutes = clockToMinutes(start);
                  const endMinutes = Math.min(startMinutes + 120, 23 * 60 + 55);
                  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
                  set(day, [...slots, { start, end }], true);
                }}
              >
                <PlusIcon data-icon="inline-start" aria-hidden />
                {t("settings.hours.addSlot")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={`${t("settings.hours.copyToAll")} (${dayLabel})`}
                  >
                    <CopyIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraft(null);
                      onCommit(Object.fromEntries(WEEKDAY_KEYS.map((d) => [d, [...slots]])));
                    }}
                  >
                    {t("settings.hours.copyToAll")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraft(null);
                      onCommit({
                        ...week,
                        ...Object.fromEntries(WEEKDAYS.map((d) => [d, [...slots]])),
                      });
                    }}
                  >
                    {t("settings.hours.copyToWeekdays")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
