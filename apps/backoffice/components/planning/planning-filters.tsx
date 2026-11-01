"use client";

import {
  hasPlanningFilters,
  NO_FILTERS_PARAM,
  planningFilterPairs,
  PLANNING_COLORS,
  type PlanningColor,
  type PlanningFilters,
} from "@salle/shared";
import { PlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FilterChip } from "@/components/views/filter-bar";
import { useUrlState } from "@/hooks/use-url-state";
import { type MessageKey, t } from "@/lib/i18n";

type Option = { id: string; name: string; color?: string | undefined };
type ListKey = "disciplines" | "coaches" | "rooms";
const LIST_KEYS: ListKey[] = ["disciplines", "coaches", "rooms"];
const LABEL: Record<ListKey | "mine", MessageKey> = {
  disciplines: "planning.filters.disciplines",
  coaches: "planning.filters.coaches",
  rooms: "planning.filters.rooms",
  mine: "planning.filters.mine",
};

/**
 * Filtres du planning en puces (disciplines, coachs, salles, « Mes séances ») et choix des
 * couleurs (par discipline ou par coach), portés par l'URL (`d`, `c`, `s`, `mes`, `couleur`)
 * comme la barre de filtres des adhérents ; `semaine`, `jour` et `vue` sont conservés.
 */
export function PlanningFilters({
  filters,
  baseFilters,
  color,
  baseColor,
  options,
  canMine,
}: {
  filters: PlanningFilters;
  /** Filtres de la vue ouverte : si on les retire tous, l'URL le dit (`f0`). */
  baseFilters: PlanningFilters;
  color: PlanningColor;
  /** Couleur de la vue ouverte (`?couleur=` absent quand elle est choisie). */
  baseColor: PlanningColor;
  options: Record<ListKey, Option[]>;
  /** L'utilisateur coache des séances : « Mes séances » proposé. */
  canMine: boolean;
}) {
  const { set } = useUrlState();
  const [editing, setEditing] = useState<ListKey | null>(null);
  const colorId = useId();

  function apply(next: PlanningFilters) {
    const changes: Record<string, string | null> = { d: null, c: null, s: null, mes: null };
    changes[NO_FILTERS_PARAM] = null;
    for (const [key, value] of planningFilterPairs(next)) changes[key] = value;
    if (!hasPlanningFilters(next) && hasPlanningFilters(baseFilters))
      changes[NO_FILTERS_PARAM] = "1";
    set(changes, { keepPage: true });
  }
  function setList(key: ListKey, ids: string[]) {
    const next = { ...filters };
    if (ids.length) next[key] = ids;
    else delete next[key];
    apply(next);
  }

  const nameOf = (key: ListKey, id: string) =>
    options[key].find((option) => option.id === id)?.name ?? "?";
  const active = LIST_KEYS.filter((key) => filters[key]?.length);
  const draft = editing && !active.includes(editing) ? editing : null;
  const available = LIST_KEYS.filter((key) => !filters[key]?.length && options[key].length);

  const editor = (key: ListKey) => (
    <Combobox
      multiple
      aria-label={t(LABEL[key])}
      options={options[key].map((option) => ({
        value: option.id,
        label: option.name,
        ...(option.color ? { color: option.color } : {}),
        ...(key === "coaches" ? { person: true } : {}),
      }))}
      value={filters[key] ?? []}
      onChange={(ids) => setList(key, ids)}
    />
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {active.map((key) => (
          <FilterChip
            key={key}
            label={t(LABEL[key])}
            value={(filters[key] ?? []).map((id) => nameOf(key, id)).join(", ")}
            open={editing === key}
            onOpenChange={(open) => setEditing(open ? key : null)}
            onRemove={() => setList(key, [])}
            editable
          >
            {editor(key)}
          </FilterChip>
        ))}
        {draft ? (
          <FilterChip
            label={t(LABEL[draft])}
            value="…"
            open
            onOpenChange={(open) => !open && setEditing(null)}
            editable
          >
            {editor(draft)}
          </FilterChip>
        ) : null}
        {filters.mine ? (
          <FilterChip
            label={t(LABEL.mine)}
            value=""
            open={false}
            onOpenChange={() => undefined}
            onRemove={() => {
              const next = { ...filters };
              delete next.mine;
              apply(next);
            }}
            editable={false}
          >
            {null}
          </FilterChip>
        ) : null}
        {available.length || (canMine && !filters.mine) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                <PlusIcon data-icon="inline-start" aria-hidden />
                {t("filters.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {canMine && !filters.mine ? (
                <DropdownMenuItem onSelect={() => apply({ ...filters, mine: true })}>
                  {t(LABEL.mine)}
                </DropdownMenuItem>
              ) : null}
              {available.map((key) => (
                <DropdownMenuItem key={key} onSelect={() => setEditing(key)}>
                  {t(LABEL[key])}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {active.length + (filters.mine ? 1 : 0) > 1 ? (
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
      <div className="flex shrink-0 items-center gap-2">
        <label htmlFor={colorId} className="text-sm whitespace-nowrap text-muted-foreground">
          {t("planning.filters.colors")}
        </label>
        <NativeSelect
          id={colorId}
          size="sm"
          value={color}
          onChange={(event) => {
            const next = PLANNING_COLORS.find((candidate) => candidate === event.target.value);
            if (next) set({ couleur: next === baseColor ? null : next }, { keepPage: true });
          }}
        >
          <NativeSelectOption value="discipline">
            {t("planning.filters.colorDiscipline")}
          </NativeSelectOption>
          <NativeSelectOption value="coach">{t("planning.filters.colorCoach")}</NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}
