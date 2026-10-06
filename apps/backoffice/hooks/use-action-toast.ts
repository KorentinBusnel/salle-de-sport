"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/i18n";

/**
 * Appelle une Server Action qui renvoie un ActionResult : toast de succès ou d'erreur, puis
 * rafraîchissement des données serveur de la page (sans redirection ni second rendu).
 */
export function useActionToast() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: () => Promise<ActionResult<unknown>>, options?: { onSuccess?: () => void }) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          const result = await action();
          if (!result.ok) {
            toast.error(t(result.error), { closeButton: true });
            resolve(false);
            return;
          }
          if (result.message) {
            toast.success(
              t(result.message, result.count !== undefined ? { count: result.count } : undefined),
            );
          }
          options?.onSuccess?.();
          router.refresh();
          resolve(true);
        });
      }),
    [router],
  );

  return { run, pending };
}
