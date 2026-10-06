"use client";

import { CalendarDaysIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dateToKey, keyToDate } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/lib/i18n";

/**
 * Mini-calendrier du planning : aller directement à une date (sa semaine, ce jour en vue
 * jour). `query` garde les autres réglages de l'URL (vue, filtres).
 */
export function WeekPicker({ selected, query }: { selected: string; query: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const day = keyToDate(selected);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("planning.pickDate")}
          aria-busy={pending || undefined}
        >
          <CalendarDaysIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          {...(day ? { selected: day, defaultMonth: day } : {})}
          showOutsideDays
          onSelect={(date) => {
            if (!date) return;
            const key = dateToKey(date);
            const params = new URLSearchParams(query);
            params.set("semaine", key);
            params.set("jour", key);
            setOpen(false);
            startTransition(() => router.push(`/planning?${params.toString()}`));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
