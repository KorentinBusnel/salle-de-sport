"use client";

import type { MemberStatus } from "@salle/shared";
import { CirclePauseIcon, CirclePlayIcon, UserRoundIcon } from "lucide-react";
import { type RowAction, RowActionsMenu } from "@/components/data-table/row-actions-menu";
import { setMemberStatusQuick } from "@/app/(app)/adherents/actions";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

const outcome = (result: { ok: true } | { ok: false; error: Parameters<typeof t>[0] }) =>
  result.ok ? {} : { error: result.error };

/**
 * Menu « … » d'un adhérent : ouvrir la fiche ; suspendre ou réactiver avec « Annuler » (action
 * réversible). La résiliation, irréversible pour l'adhérent, reste sur la fiche avec confirmation.
 */
export function MemberRowMenu({
  memberId,
  name,
  status,
  canSuspend,
}: {
  memberId: string;
  name: string;
  status: MemberStatus;
  canSuspend: boolean;
}) {
  const change = (to: "active" | "suspended", back: "active" | "suspended", message: string) =>
    toastUndo({
      message,
      mode: "inverse",
      id: `statut-${memberId}`,
      run: async () => outcome(await setMemberStatusQuick({ memberId, status: to })),
      undo: async () => outcome(await setMemberStatusQuick({ memberId, status: back })),
    });
  const actions: RowAction[] = [
    { label: t("members.openProfile"), icon: UserRoundIcon, href: `/adherents/${memberId}` },
  ];
  if (canSuspend && status === "active")
    actions.push({
      label: t("members.suspend"),
      icon: CirclePauseIcon,
      separated: true,
      onSelect: () => change("suspended", "active", t("members.suspendedName", { name })),
    });
  if (canSuspend && status === "suspended")
    actions.push({
      label: t("members.reactivate"),
      icon: CirclePlayIcon,
      separated: true,
      onSelect: () => change("active", "suspended", t("members.reactivatedName", { name })),
    });
  return <RowActionsMenu label={name} actions={actions} />;
}
