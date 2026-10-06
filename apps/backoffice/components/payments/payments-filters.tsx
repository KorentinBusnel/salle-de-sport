"use client";

import { DateRangeField } from "@/components/forms/date-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

const ALL = "all";

/** Filtres des paiements appliqués aussitôt : période, statut, moyen de paiement. */
export function PaymentsFilters({
  from,
  to,
  todayKey,
  status,
  method,
  statuses,
  methods,
}: {
  from: string;
  to: string;
  todayKey: string;
  status: string | null;
  method: string | null;
  statuses: readonly string[];
  methods: readonly string[];
}) {
  const { set, pending } = useUrlState();
  return (
    <div
      role="search"
      aria-label={t("payments.filters")}
      className="flex flex-col gap-2 lg:flex-row lg:items-center"
    >
      <DateRangeField
        value={{ from, to }}
        onChange={(range) => set({ du: range?.from ?? null, au: range?.to ?? null })}
        todayKey={todayKey}
        max={todayKey}
        aria-label={t("payments.periodLabel")}
        className="lg:w-64"
      />
      <div className="grid grid-cols-2 gap-2 lg:flex">
        <Select
          value={status ?? ALL}
          onValueChange={(value) => set({ statut: value === ALL ? null : value })}
        >
          <SelectTrigger aria-label={t("payments.status")} className="w-full bg-card lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("payments.allStatuses")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`billing.paymentStatus.${s as "succeeded"}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={method ?? ALL}
          onValueChange={(value) => set({ moyen: value === ALL ? null : value })}
        >
          <SelectTrigger aria-label={t("payments.method")} className="w-full bg-card lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("payments.allMethods")}</SelectItem>
            {methods.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`billing.methodLabel.${m as "card"}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pending ? <Spinner aria-label={t("ui.loading")} /> : null}
    </div>
  );
}
