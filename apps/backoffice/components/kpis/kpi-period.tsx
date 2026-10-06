"use client";

import { DateRangeField } from "@/components/forms/date-fields";
import { Spinner } from "@/components/ui/spinner";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

/** Période des indicateurs (raccourcis : 7, 30, 90 jours, mois, année) appliquée aussitôt. */
export function KpiPeriod({ from, to, todayKey }: { from: string; to: string; todayKey: string }) {
  const { set, pending } = useUrlState();
  return (
    <div className="flex items-center gap-2">
      {pending ? <Spinner aria-label={t("ui.loading")} /> : null}
      <DateRangeField
        value={{ from, to }}
        onChange={(range) =>
          set(
            range
              ? { du: range.from, au: range.to, jours: null }
              : { du: null, au: null, jours: null },
          )
        }
        todayKey={todayKey}
        max={todayKey}
        aria-label={t("kpis.presets")}
        className="w-64"
      />
    </div>
  );
}
