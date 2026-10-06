"use client";

import { Combobox } from "@/components/forms/combobox";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

/** Filtre par étiquette (combinable avec le statut et la recherche). */
export function TagFilter({
  tags,
  value,
}: {
  tags: { tag: string; uses: number }[];
  value: string;
}) {
  const { set } = useUrlState();
  return (
    <Combobox
      aria-label={t("members.tagFilter")}
      options={tags.map((row) => ({
        value: row.tag,
        label: row.tag,
        description: t("forms.tagUses", { count: row.uses }),
      }))}
      value={value || null}
      onChange={(next) => set({ tag: next })}
      clearable
      placeholder={t("members.tagFilter")}
      className="min-w-0 flex-1 sm:w-48 sm:flex-none"
    />
  );
}
