"use client";

import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from "@salle/shared";
import { BanknoteIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadReminder, sendReminder, settleUnpaid } from "@/app/(app)/relances-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";

/**
 * Actions sur un impayé (accueil et gérant) : « Relancer » (message préparé en base, modifiable)
 * et, pour un abonnement suivi à la main, « Encaisser » sur place.
 */
export function UnpaidActions({
  memberId,
  name,
  amount,
  subscriptionId,
  settleable,
}: {
  memberId: string;
  name: string;
  amount: string;
  subscriptionId: string | null;
  settleable: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();
  const [settleOpen, setSettleOpen] = useState(false);
  const [method, setMethod] = useState<ManualPaymentMethod>("card");
  const [settling, startSettling] = useTransition();

  function openReminder() {
    startLoading(async () => {
      const result = await loadReminder({ memberId });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      setSubject(result.data.subject);
      setBody(result.data.body);
      setOpen(true);
    });
  }

  function send() {
    startSending(async () => {
      const result = await sendReminder({ memberId, subject, body });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("unpaid.reminded"));
      setOpen(false);
      router.refresh();
    });
  }

  function settle() {
    if (!subscriptionId) return;
    startSettling(async () => {
      const result = await settleUnpaid({ subscriptionId, method });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("unpaid.settled"));
      setSettleOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={openReminder}
        disabled={loading}
        aria-busy={loading}
        aria-label={t("unpaid.remindOf", { name })}
      >
        {loading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <SendIcon data-icon="inline-start" aria-hidden />
        )}
        {t("unpaid.remind")}
      </Button>
      {settleable && subscriptionId ? (
        <Popover open={settleOpen} onOpenChange={setSettleOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" aria-label={t("unpaid.settleOf", { name })}>
              <BanknoteIcon data-icon="inline-start" aria-hidden />
              {t("unpaid.settle")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="grid w-72 gap-3">
            <p className="text-sm">{t("unpaid.settleHint", { name, amount })}</p>
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
            <Button onClick={settle} disabled={settling} aria-busy={settling}>
              {settling ? <Spinner data-icon="inline-start" /> : null}
              {t("unpaid.confirmSettle", { amount })}
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("unpaid.remindTitle", { name })}</DialogTitle>
            <DialogDescription>{t("unpaid.remindHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-subject`}>{t("unpaid.subject")}</Label>
              <Input
                id={`${ids}-subject`}
                value={subject}
                maxLength={200}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-body`}>{t("unpaid.body")}</Label>
              <Textarea
                id={`${ids}-body`}
                value={body}
                rows={9}
                maxLength={5000}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={send}
              disabled={sending || !subject.trim() || !body.trim()}
              aria-busy={sending}
            >
              {sending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SendIcon data-icon="inline-start" aria-hidden />
              )}
              {t("unpaid.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
