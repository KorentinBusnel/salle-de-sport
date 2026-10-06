"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { generateSessions } from "@/app/(app)/planning/modeles/actions";
import { DateRangeField, type DateRangeValue } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/** Génération des séances sur une période choisie (raccourcis vers l'avenir). */
export function GenerateSessionsForm({
  todayKey,
  defaultRange,
}: {
  todayKey: string;
  defaultRange: DateRangeValue;
}) {
  const [range, setRange] = useState<DateRangeValue | null>(defaultRange);
  const [pending, startTransition] = useTransition();
  const id = useId();
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!range) return;
        startTransition(async () => {
          const result = await generateSessions(range);
          if (!result.ok) toast.error(t(result.error), { closeButton: true });
          else if (result.message) toast.success(t(result.message, { count: result.count ?? 0 }));
        });
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {t("templates.period")}
        </label>
        <DateRangeField
          id={id}
          value={range}
          onChange={setRange}
          todayKey={todayKey}
          min={todayKey}
          presets={["next7", "next14", "next28", "nextMonth"]}
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending || !range} className="w-fit">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {t("templates.generate")}
      </Button>
    </form>
  );
}
