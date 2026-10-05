"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { reorderDisciplines } from "@/app/(app)/parametres/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

/** « Monter / Descendre » une discipline (ordre du planning et des listes), avec « Annuler ». */
export function DisciplineOrder({
  ids,
  index,
  name,
}: {
  ids: string[];
  index: number;
  name: string;
}) {
  const router = useRouter();

  function move(direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    toastUndo({
      message: t("catalog.reordered"),
      mode: "inverse",
      run: async () => {
        const result = await reorderDisciplines({ ids: next });
        return result.ok ? {} : { error: result.error };
      },
      undo: async () => {
        const result = await reorderDisciplines({ ids });
        return result.ok ? {} : { error: result.error };
      },
      onSettled: () => router.refresh(),
    });
  }

  return (
    <span className="flex gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === 0}
        aria-label={t("catalog.moveUp", { name })}
        onClick={() => move(-1)}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === ids.length - 1}
        aria-label={t("catalog.moveDown", { name })}
        onClick={() => move(1)}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
    </span>
  );
}
