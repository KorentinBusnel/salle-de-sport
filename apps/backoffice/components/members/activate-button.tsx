"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setMemberStatusQuick } from "@/app/(app)/adherents/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/** « Activer » une inscription en un clic (l'automatisation de bienvenue peut partir). */
export function ActivateButton({ memberId, name }: { memberId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      aria-label={t("members.activateName", { name })}
      onClick={() =>
        startTransition(async () => {
          const result = await setMemberStatusQuick({ memberId, status: "active" });
          if (!result.ok) toast.error(t(result.error), { closeButton: true });
          else toast.success(t("members.activatedName", { name }));
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {t("members.activate")}
    </Button>
  );
}
