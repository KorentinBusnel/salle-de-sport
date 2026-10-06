"use client";

import { Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { refundPayment } from "@/app/(app)/parametres/stripe-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Remboursement d'un paiement en ligne, confirmé (irréversible). */
export function RefundButton({ id, amount, name }: { id: string; amount: string; name: string }) {
  const [open, setOpen] = useState(false);

  async function refund() {
    const result = await refundPayment({ id });
    if (!result.ok) {
      if (result.error === "stripeErrors.stripe_not_configured") toast.info(t(result.error));
      else toast.error(t(result.error), { closeButton: true });
      return;
    }
    toast.success(t("payments.refundRequested"));
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("payments.refundOf", { amount })}
      >
        <Undo2Icon data-icon="inline-start" aria-hidden />
        {t("payments.refund")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("payments.refundTitle")}
        description={t("payments.refundBody", { amount, name })}
        confirmLabel={t("payments.refund")}
        action={refund}
      />
    </>
  );
}
