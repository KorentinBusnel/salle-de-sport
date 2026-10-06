"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { MonthPicker } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

/** Mois affiché (`?mois=AAAA-MM`) : mois précédent, choix dans la grille, mois suivant. */
export function MonthNav({
  month,
  previous,
  next,
  max,
}: {
  month: string;
  previous: string;
  next: string;
  max?: string | undefined;
}) {
  const { set, pending } = useUrlState();
  const go = (value: string | null) => value && set({ mois: value });
  return (
    <div className="flex items-center gap-1">
      {pending ? <Spinner aria-label={t("ui.loading")} className="mr-1" /> : null}
      <Button
        variant="outline"
        size="icon"
        onClick={() => go(previous)}
        aria-label={t("hours.previousMonth")}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <MonthPicker
        value={month}
        onChange={go}
        max={max}
        aria-label={t("hours.month")}
        className="w-44"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => go(next)}
        disabled={max !== undefined && next > max}
        aria-label={t("hours.nextMonth")}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
