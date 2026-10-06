"use client";

import type { SegmentFilters } from "@salle/shared";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Combobox } from "@/components/forms/combobox";
import { DateField } from "@/components/forms/date-fields";
import { TagInput } from "@/components/forms/tag-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";
import { filtersToSearch } from "@/lib/segments";
import { cn } from "@/lib/utils";

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
const ADVANCED = [
  "inactive_days",
  "discipline_id",
  "max_credits",
  "joined_since",
  "birthday_month",
] as const;

/**
 * Filtres d'un segment appliqués au fil de la saisie : l'URL suit (aperçu partageable), la
 * liste se grise le temps du calcul. Filtres moins courants repliés (Watermelon collapsible-5).
 */
export function SegmentFiltersForm({
  filters,
  segmentId,
  disciplines,
}: {
  filters: SegmentFilters;
  segmentId: string | null;
  disciplines: { id: string; name: string }[];
}) {
  const { replaceQuery } = useUrlState();
  const [draft, setDraft] = useState(filters);
  const [source, setSource] = useState(JSON.stringify(filters));
  // Les filtres du serveur font foi dès qu'ils changent (segment ouvert, réinitialisation).
  if (source !== JSON.stringify(filters)) {
    setSource(JSON.stringify(filters));
    setDraft(filters);
  }
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const ids = {
    tags: useId(),
    inactive: useId(),
    discipline: useId(),
    credits: useId(),
    joined: useId(),
  };
  const advancedSet = ADVANCED.some((key) => draft[key] !== undefined);
  const [open, setOpen] = useState(advancedSet);

  function apply(next: SegmentFilters, delay = 0) {
    setDraft(next);
    window.clearTimeout(timer.current);
    const query = [segmentId ? `segment=${segmentId}` : "", filtersToSearch(next)]
      .filter(Boolean)
      .join("&");
    timer.current = window.setTimeout(() => replaceQuery(query), delay);
  }

  function update<K extends keyof SegmentFilters>(
    key: K,
    value: SegmentFilters[K] | undefined,
    delay = 0,
  ) {
    const next = { ...draft };
    if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
    apply(next, delay);
  }

  const number = (raw: string, max: number) => {
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : undefined;
  };

  return (
    <form className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
      <FieldSet>
        <FieldLegend variant="label">{t("segments.status")}</FieldLegend>
        <div className="flex flex-wrap gap-4">
          {STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.statuses?.includes(status) ?? false}
                onCheckedChange={(checked) =>
                  update(
                    "statuses",
                    checked
                      ? [...(draft.statuses ?? []), status]
                      : (draft.statuses ?? []).filter((s) => s !== status),
                  )
                }
              />
              {t(`memberStatus.${status}`)}
            </label>
          ))}
        </div>
      </FieldSet>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor={ids.tags}>{t("segments.tags")}</FieldLabel>
          <TagInput
            id={ids.tags}
            value={draft.tags ?? []}
            onChange={(tags) => update("tags", tags)}
            placeholder={t("segments.tagsPlaceholder")}
          />
        </Field>
        <label className="flex h-8 items-center gap-2 text-sm pointer-coarse:h-10">
          <Checkbox
            checked={draft.email_consent ?? false}
            onCheckedChange={(checked) => update("email_consent", checked === true || undefined)}
          />
          {t("segments.emailConsent")}
        </label>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit">
            <ChevronDownIcon
              data-icon="inline-start"
              aria-hidden
              className={cn("transition-transform duration-200", open && "rotate-180")}
            />
            {t("segments.moreFilters")}
            {advancedSet && !open ? (
              <span className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground tabular-nums">
                {ADVANCED.filter((key) => draft[key] !== undefined).length}
              </span>
            ) : null}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-5 pt-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={ids.inactive}>{t("segments.inactiveDays")}</FieldLabel>
            <Input
              id={ids.inactive}
              type="number"
              min={1}
              max={365}
              className="w-28 max-w-28 tabular-nums"
              value={draft.inactive_days ?? ""}
              onChange={(event) =>
                update("inactive_days", number(event.target.value, 365) || undefined, 400)
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.discipline}>{t("segments.discipline")}</FieldLabel>
            <Combobox
              id={ids.discipline}
              options={disciplines.map((d) => ({ value: d.id, label: d.name }))}
              value={draft.discipline_id ?? null}
              onChange={(value) => update("discipline_id", value ?? undefined)}
              clearable
              placeholder={t("segments.any")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.credits}>{t("segments.maxCredits")}</FieldLabel>
            <Input
              id={ids.credits}
              type="number"
              min={0}
              max={100}
              className="w-28 max-w-28 tabular-nums"
              value={draft.max_credits ?? ""}
              onChange={(event) => update("max_credits", number(event.target.value, 100), 400)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.joined}>{t("segments.joinedSince")}</FieldLabel>
            <DateField
              id={ids.joined}
              value={draft.joined_since ?? null}
              onChange={(value) => update("joined_since", value ?? undefined)}
              clearable
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.birthday_month ?? false}
              onCheckedChange={(checked) => update("birthday_month", checked === true || undefined)}
            />
            {t("segments.birthdayMonth")}
          </label>
        </CollapsibleContent>
      </Collapsible>

      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={segmentId ? `/segments?segment=${segmentId}` : "/segments"} scroll={false}>
          {t("segments.reset")}
        </Link>
      </Button>
    </form>
  );
}
