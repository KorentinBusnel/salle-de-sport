"use client";

import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from "@salle/shared";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelSubscription, renewSubscription } from "@/app/(app)/adherents/[id]/billing-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";

/**
 * Abonnement suivi à la main : « Renouveler » (une période, mode de paiement à choisir) et,
 * pour le gérant, « Arrêter » à la fin de la période payée (confirmé).
 */
export function SubscriptionActions({
  subscriptionId,
  price,
  canRenew,
  canCancel,
}: {
  subscriptionId: string;
  price: string;
  canRenew: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [method, setMethod] = useState<ManualPaymentMethod>("card");
  const [pending, startTransition] = useTransition();

  function renew() {
    startTransition(async () => {
      const result = await renewSubscription({ subscriptionId, method });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("billing.renewed"));
      setOpen(false);
      router.refresh();
    });
  }

  async function cancel() {
    const result = await cancelSubscription({ subscriptionId });
    if (!result.ok) {
      toast.error(t(result.error), { closeButton: true });
      return;
    }
    toast.success(t("billing.cancelled"));
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canRenew ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm">
              <RefreshCwIcon data-icon="inline-start" aria-hidden />
              {t("billing.renew")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-72 gap-3">
            <p className="text-sm">{t("billing.renewHint", { price })}</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={method}
              onValueChange={(value) => value && setMethod(value as ManualPaymentMethod)}
              aria-label={t("billing.method")}
              className="w-full"
            >
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <ToggleGroupItem key={m} value={m} className="flex-1">
                  {t(`billing.manualMethod.${m}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button onClick={renew} disabled={pending} aria-busy={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("billing.confirmRenew")}
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}
      {canCancel ? (
        <>
          <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
            <XCircleIcon data-icon="inline-start" aria-hidden />
            {t("billing.stop")}
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={t("billing.stopTitle")}
            description={t("billing.stopBody")}
            confirmLabel={t("billing.stop")}
            action={cancel}
          />
        </>
      ) : null}
    </div>
  );
}
