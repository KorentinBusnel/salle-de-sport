"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { syncPlanWithStripe, syncPromoWithStripe } from "@/app/(app)/parametres/stripe-actions";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/**
 * État Stripe d'une offre ou d'un code promo, et « Synchroniser ». Sans clé Stripe, la fonction
 * répond « non configuré » : un toast d'information, jamais une erreur bloquante.
 */
export function StripeSync({
  kind,
  id,
  name,
  synced,
}: {
  kind: "plan" | "promo";
  id: string;
  name: string;
  synced: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function sync() {
    startTransition(async () => {
      const action = kind === "plan" ? syncPlanWithStripe : syncPromoWithStripe;
      const result = await action({ id });
      if (!result.ok) {
        if (result.error === "stripeErrors.stripe_not_configured") toast.info(t(result.error));
        else toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("offers.syncDone"));
    });
  }

  return (
    <span className="flex items-center gap-1">
      <StatusPill tone={synced ? "success" : "neutral"}>
        {t(synced ? "offers.synced" : "offers.notSynced")}
      </StatusPill>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={sync}
        disabled={pending}
        aria-busy={pending}
        aria-label={t("offers.syncOf", { name })}
        title={t("offers.syncStripe")}
      >
        {pending ? <Spinner /> : <RefreshCwIcon aria-hidden />}
      </Button>
    </span>
  );
}
