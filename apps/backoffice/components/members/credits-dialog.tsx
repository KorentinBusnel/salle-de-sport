"use client";

import { CoinsIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

const MIN = 1;
const MAX = 50;

/** Ajout de crédits : quantité au stepper, motif, solde avant → après, puis Server Action. */
export function CreditsDialog({
  memberId,
  memberName,
  balance,
  returnQuery,
  action,
}: {
  memberId: string;
  memberName: string;
  balance: number;
  returnQuery: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const clamp = (value: number) => Math.min(MAX, Math.max(MIN, Math.round(value) || MIN));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAmount(1);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("members.creditsFor", { name: memberName })}
        >
          <CoinsIcon data-icon="inline-start" />
          {t("members.creditsButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={action} onSubmit={() => setOpen(false)} className="grid gap-5">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="returnQuery" value={returnQuery} />
          <DialogHeader>
            <DialogTitle>{t("members.creditsTitle")}</DialogTitle>
            <DialogDescription>{memberName}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`amount-${memberId}`}>{t("members.creditsAmount")}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAmount((a) => clamp(a - 1))}
                disabled={amount <= MIN}
                aria-label={t("members.creditsLess")}
              >
                <MinusIcon />
              </Button>
              <Input
                id={`amount-${memberId}`}
                name="amount"
                type="number"
                inputMode="numeric"
                min={MIN}
                max={MAX}
                required
                value={amount}
                onChange={(event) => setAmount(clamp(Number(event.target.value)))}
                className="w-20 text-center text-lg tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAmount((a) => clamp(a + 1))}
                disabled={amount >= MAX}
                aria-label={t("members.creditsMore")}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`note-${memberId}`}>{t("members.creditsNote")}</Label>
            <Input
              id={`note-${memberId}`}
              name="note"
              maxLength={200}
              placeholder={t("members.creditsNotePlaceholder")}
            />
          </div>

          <p
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
            aria-live="polite"
          >
            <span className="text-muted-foreground">{t("members.creditsBalance")}</span>
            <span className="font-medium tabular-nums">
              {balance} → {balance + amount}
            </span>
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <SubmitButton>{t("members.creditsConfirm", { count: amount })}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
