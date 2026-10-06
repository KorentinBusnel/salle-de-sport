"use client";

import { PackageCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptQuote, declineQuote, updateOrder } from "@/app/(app)/marketplace/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/i18n";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>, onDone?: () => void) =>
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      if (result.message) toast.success(t(result.message));
      onDone?.();
      router.refresh();
    });
  return { pending, run };
}

/** Commande : annuler tant qu'elle n'est pas payée, réceptionner une fois expédiée ou livrée. */
export function OrderActions({
  id,
  reference,
  canCancel,
  canReceive,
}: {
  id: string;
  reference: string;
  canCancel: boolean;
  canReceive: boolean;
}) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex justify-end gap-1.5">
      {canReceive ? (
        <Button
          size="sm"
          onClick={() => run(() => updateOrder({ id, action: "receive" }))}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PackageCheckIcon data-icon="inline-start" aria-hidden />
          )}
          {t("marketplace.orders.receive")}
        </Button>
      ) : null}
      {canCancel ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            {t("marketplace.orders.cancel")}
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={t("marketplace.orders.cancelTitle", { reference })}
            description={t("marketplace.orders.cancelBody")}
            confirmLabel={t("marketplace.orders.cancel")}
            action={async () => {
              await new Promise<void>((resolve) =>
                run(
                  () => updateOrder({ id, action: "cancel" }),
                  () => {
                    setConfirm(false);
                    resolve();
                  },
                ),
              );
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** Devis répondu : accepter (commande créée) ou refuser. */
export function QuoteActions({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <div className="flex gap-1.5">
      <Button size="sm" onClick={() => run(() => acceptQuote({ id }))} disabled={pending}>
        {t("marketplace.quotes.accept")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => run(() => declineQuote({ id }))}
        disabled={pending}
      >
        {t("marketplace.quotes.decline")}
      </Button>
    </div>
  );
}
