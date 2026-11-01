"use client";

import { STAGE_GROUP } from "@salle/shared";
import { useId, useState } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

/**
 * « Grouper par » d'un kanban : les étapes du pipeline ou un champ liste. Porté par l'URL
 * (`?groupe=`, absent quand il vaut celui de la vue ouverte), puis enregistré avec la vue.
 */
export function GroupBySelect({
  value,
  viewDefault,
  fields,
}: {
  value: string;
  /** Groupement de la vue ouverte. */
  viewDefault: string;
  fields: { key: string; label: string }[];
}) {
  const id = useId();
  const { set } = useUrlState();
  // Valeur choisie affichée aussitôt ; celle du serveur reprend la main quand elle change.
  const [shown, setShown] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setShown(value);
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm whitespace-nowrap text-muted-foreground">
        {t("crm.groupBy")}
      </label>
      <NativeSelect
        id={id}
        size="sm"
        value={shown}
        onChange={(event) => {
          const next = event.target.value;
          setShown(next);
          set({ groupe: next === viewDefault ? null : next }, { keepPage: true });
        }}
      >
        <NativeSelectOption value={STAGE_GROUP}>{t("crm.groupByStages")}</NativeSelectOption>
        {fields.map((field) => (
          <NativeSelectOption key={field.key} value={`f:${field.key}`}>
            {field.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
