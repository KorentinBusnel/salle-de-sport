"use client";

import { formatMoney, MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from "@salle/shared";
import { BadgeCheckIcon, ShoppingBagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { recordSale } from "@/app/(app)/adherents/[id]/billing-actions";
import { Combobox } from "@/components/forms/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type MessageKey, t } from "@/lib/i18n";

export type SalePlan = {
  id: string;
  name: string;
  price: string;
  type: "recurring" | "pack" | "single";
  audience: string | null;
  requiresProof: boolean;
};

type Quote = { price_cents: number; final_cents: number; promo_code_id: string | null };

/**
 * Vente sur place (espèces, terminal de carte, autre) : offre, mode de paiement, code promo
 * avec le prix final recalculé au fil de la saisie ; l'abonnement est suivi hors Stripe.
 */
export function SaleSheet({
  memberId,
  memberName,
  plans,
  hasSubscription,
}: {
  memberId: string;
  memberName: string;
  plans: SalePlan[];
  hasSubscription: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <ShoppingBagIcon data-icon="inline-start" aria-hidden />
          {t("billing.sell")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        {open ? (
          <SaleForm
            memberId={memberId}
            memberName={memberName}
            plans={plans}
            hasSubscription={hasSubscription}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SaleForm({
  memberId,
  memberName,
  plans,
  hasSubscription,
  onDone,
}: {
  memberId: string;
  memberName: string;
  plans: SalePlan[];
  hasSubscription: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<ManualPaymentMethod>("card");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<{
    key: string;
    value: Quote | null;
    error: MessageKey | null;
  }>();
  const [pending, startTransition] = useTransition();
  const plan = plans.find((p) => p.id === planId) ?? null;
  const key = `${planId ?? ""}|${code.trim().toUpperCase()}`;
  const loading = planId !== null && quote?.key !== key;
  const blocked = plan?.type === "recurring" && hasSubscription;

  // Prix final : relu au fil de la saisie du code (attente de 250 ms).
  useEffect(() => {
    if (!planId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ offre: planId, code: code.trim() });
        const response = await fetch(`/api/ventes/devis?${query}`, { signal: controller.signal });
        const data = (await response.json()) as Quote & { error?: string };
        const failed = !response.ok || Boolean(data.error);
        setQuote({
          key,
          value: failed ? null : data,
          error: !failed
            ? null
            : data.error && data.error !== "unexpected"
              ? (`bookingErrors.${data.error}` as MessageKey)
              : "common.unexpectedError",
        });
      } catch {
        // Saisie plus récente : requête abandonnée.
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [planId, code, key]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!planId || blocked || quote?.error) return;
    startTransition(async () => {
      const result = await recordSale({
        memberId,
        planId,
        method,
        ...(code.trim() ? { promoCode: code.trim() } : {}),
      });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("billing.saleRecordedFor", { name: memberName }));
      onDone();
      router.refresh();
    });
  }

  const final = quote?.key === key ? quote.value : null;
  return (
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
      <SheetHeader>
        <SheetTitle>{t("billing.sellTitle", { name: memberName })}</SheetTitle>
        <SheetDescription>{t("billing.sellHint")}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="sale-plan">{t("billing.plan")}</FieldLabel>
            <Combobox
              id="sale-plan"
              options={plans.map((p) => ({
                value: p.id,
                label: p.name,
                description: [p.price, p.audience].filter(Boolean).join(" · "),
              }))}
              value={planId}
              onChange={setPlanId}
              placeholder={t("billing.choosePlan")}
            />
            {blocked ? (
              <FieldDescription className="text-destructive">
                {t("bookingErrors.already_subscribed")}
              </FieldDescription>
            ) : null}
          </Field>
          {plan?.requiresProof ? (
            <Alert>
              <BadgeCheckIcon aria-hidden />
              <AlertDescription>
                {t("billing.proofReminder", {
                  audience: plan.audience ?? t("billing.reducedRate"),
                })}
              </AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel id="sale-method-label">{t("billing.method")}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              value={method}
              onValueChange={(value) => value && setMethod(value as ManualPaymentMethod)}
              aria-labelledby="sale-method-label"
              className="w-full"
            >
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <ToggleGroupItem key={m} value={m} className="flex-1">
                  {t(`billing.manualMethod.${m}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="sale-code">{t("billing.promoCode")}</FieldLabel>
            <Input
              id="sale-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={30}
              autoComplete="off"
              className="font-mono uppercase"
              placeholder={t("billing.promoPlaceholder")}
            />
            {quote?.key === key && quote.error ? (
              <FieldDescription className="text-destructive" role="alert">
                {t(quote.error)}
              </FieldDescription>
            ) : null}
          </Field>
          <div
            aria-live="polite"
            className="flex items-baseline justify-between rounded-lg bg-muted/60 px-4 py-3"
          >
            <span className="text-sm text-muted-foreground">{t("billing.total")}</span>
            <span className="flex items-center gap-2 text-xl font-semibold tabular-nums">
              {loading ? <Spinner /> : null}
              {final && final.final_cents !== final.price_cents ? (
                <span className="text-sm font-normal text-muted-foreground line-through">
                  {formatMoney(final.price_cents)}
                </span>
              ) : null}
              {final ? formatMoney(final.final_cents) : plan ? plan.price : "—"}
            </span>
          </div>
        </FieldGroup>
      </SheetBody>
      <SheetFooter>
        <Button
          type="submit"
          disabled={
            !planId || blocked || pending || loading || Boolean(quote?.key === key && quote.error)
          }
          aria-busy={pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t("billing.confirmSale")}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </SheetFooter>
    </form>
  );
}
