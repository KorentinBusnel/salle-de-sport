"use client";

import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteMemberField, reorderMemberFields } from "@/app/(app)/parametres/champs-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

/*
 * Commandes d'une ligne du tableau des champs personnalisés : « Monter / Descendre » (ordre sur
 * la fiche, avec « Annuler ») et le menu « … » (suppression confirmée).
 */

/** « Monter / Descendre » un champ (ordre sur la fiche adhérent), avec « Annuler ». */
export function FieldOrder({ ids, index, name }: { ids: string[]; index: number; name: string }) {
  const router = useRouter();

  function move(direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    toastUndo({
      message: t("fields.reordered"),
      mode: "inverse",
      run: async () => {
        const result = await reorderMemberFields({ ids: next });
        return result.ok ? {} : { error: result.error };
      },
      undo: async () => {
        const result = await reorderMemberFields({ ids });
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
        aria-label={t("fields.moveUp", { name })}
        onClick={() => move(-1)}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={index === ids.length - 1}
        aria-label={t("fields.moveDown", { name })}
        onClick={() => move(1)}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
    </span>
  );
}

/** Menu « … » d'un champ : « Supprimer », confirmé (les valeurs saisies seront perdues). */
export function FieldRowMenu({
  id,
  name,
  valuesCount,
}: {
  id: string;
  name: string;
  /** Fiches qui portent une valeur pour ce champ (member_field_usage). */
  valuesCount: number;
}) {
  const [confirm, setConfirm] = useState(false);

  async function remove() {
    const result = await deleteMemberField({ id });
    if (!result.ok) {
      toast.error(t(result.error), { closeButton: true });
      return;
    }
    setConfirm(false);
    toast.success(t("fields.deleted"));
  }

  return (
    <>
      <RowActionsMenu
        label={name}
        actions={[
          {
            label: t("fields.delete"),
            icon: Trash2Icon,
            destructive: true,
            onSelect: () => setConfirm(true),
          },
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("fields.deleteTitle", { name })}
        description={t("fields.deleteConfirm", { count: valuesCount })}
        confirmLabel={t("common.delete")}
        action={remove}
      />
    </>
  );
}
