"use client";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";
import { PAGE_SIZES, type PageSize } from "@/lib/pagination";

/** Lignes par page (25, 50, 100), portées par l'URL (`?taille=`). */
export function PageSizeSelect({ value }: { value: PageSize }) {
  const { set } = useUrlState();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {t("table.perPage")}
      <NativeSelect
        size="sm"
        value={String(value)}
        onChange={(event) =>
          set({ taille: event.target.value === "25" ? null : event.target.value })
        }
        className="w-20 tabular-nums"
      >
        {PAGE_SIZES.map((size) => (
          <NativeSelectOption key={size} value={String(size)}>
            {size}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
