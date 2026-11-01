"use client";

import { useState } from "react";
import { setMemberStatusQuick } from "@/app/(app)/adherents/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

/**
 * « Activer » une inscription. Le retour au statut prospect est impossible en base (et
 * l'automatisation de bienvenue peut partir) : l'activation attend la fin du toast, « Annuler »
 * l'abandonne. Le bouton disparaît pendant ce délai et revient si l'activation n'a pas lieu.
 */
export function ActivateButton({
  memberId,
  name,
  variant = "default",
}: {
  memberId: string;
  name: string;
  /** `outline` dans une liste, où le bouton se répète sur chaque ligne. */
  variant?: "default" | "outline" | undefined;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Button
      size="sm"
      variant={variant}
      aria-label={t("members.activateName", { name })}
      onClick={() => {
        setHidden(true);
        toastUndo({
          message: t("members.activatedName", { name }),
          mode: "deferred",
          run: async () => {
            const result = await setMemberStatusQuick({ memberId, status: "active" });
            if (result.ok) return {};
            setHidden(false);
            return { error: result.error };
          },
          // « Annuler » : rien n'est parti, le bouton revient.
          onUndo: () => setHidden(false),
        });
      }}
    >
      {t("members.activate")}
    </Button>
  );
}
