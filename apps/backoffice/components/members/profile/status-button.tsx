"use client";

import { setMemberStatusQuick } from "@/app/(app)/adherents/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

/** Suspendre ou réactiver depuis la fiche : action réversible, « Annuler » plutôt que confirmer. */
export function StatusButton({
  memberId,
  name,
  to,
}: {
  memberId: string;
  name: string;
  to: "suspended" | "active";
}) {
  const back = to === "suspended" ? "active" : "suspended";
  const run = async (status: "suspended" | "active") => {
    const result = await setMemberStatusQuick({ memberId, status });
    return result.ok ? {} : { error: result.error };
  };
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        toastUndo({
          message: t(to === "suspended" ? "members.suspendedName" : "members.reactivatedName", {
            name,
          }),
          mode: "inverse",
          id: `statut-${memberId}`,
          run: () => run(to),
          undo: () => run(back),
        })
      }
    >
      {t(to === "suspended" ? "members.suspend" : "members.reactivate")}
    </Button>
  );
}
