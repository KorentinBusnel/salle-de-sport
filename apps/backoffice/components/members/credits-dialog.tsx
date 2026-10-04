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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";

const MIN = 1;
const MAX = 50;

/**
 * Ajout de crédits (ou retrait, si la stratégie de la salle l'autorise) : quantité au stepper,
 * motif (obligatoire pour un retrait), solde avant → après, puis Server Action.
 */
export function CreditsDialog({
  memberId,
  memberName,
  balance,
  returnQuery,
  returnTo,
  canRemove,
  action,
}: {
  memberId: string;
  memberName: string;
  balance: number;
  returnQuery: string;
  /** Fiche adhérent : y revenir après l'action plutôt que sur la liste. */
  returnTo?: string | undefined;
  canRemove: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [mode, setMode] = useState<"add" | "remove">("add");
  const remove = mode === "remove";
  // Un retrait ne fait pas passer le solde sous zéro (règle vérifiée aussi en SQL).
  const max = remove ? Math.max(MIN, Math.min(MAX, balance)) : MAX;
  const clamp = (value: number) => Math.min(max, Math.max(MIN, Math.round(value) || MIN));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setAmount(1);
          setMode("add");
        }
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
          {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
          <input type="hidden" name="mode" value={mode} />
          <DialogHeader>
            <DialogTitle>
              {remove ? t("members.creditsRemoveTitle") : t("members.creditsTitle")}
            </DialogTitle>
            <DialogDescription>{memberName}</DialogDescription>
          </DialogHeader>

          {canRemove ? (
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(value) => {
                if (value !== "add" && value !== "remove") return;
                setMode(value);
                setAmount(1);
              }}
              aria-label={t("members.creditsMode")}
              className="w-full"
            >
              <ToggleGroupItem value="add" className="flex-1">
                {t("members.creditsModeAdd")}
              </ToggleGroupItem>
              <ToggleGroupItem value="remove" className="flex-1" disabled={balance <= 0}>
                {t("members.creditsModeRemove")}
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}

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
                max={max}
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
                disabled={amount >= max}
                aria-label={t("members.creditsMore")}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`note-${memberId}`}>
              {remove ? t("members.creditsReason") : t("members.creditsNote")}
            </Label>
            <Input
              id={`note-${memberId}`}
              name="note"
              maxLength={200}
              required={remove}
              placeholder={
                remove ? t("members.creditsReasonPlaceholder") : t("members.creditsNotePlaceholder")
              }
            />
          </div>

          <p
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
            aria-live="polite"
          >
            <span className="text-muted-foreground">{t("members.creditsBalance")}</span>
            <span className="font-medium tabular-nums">
              {balance} → {remove ? balance - amount : balance + amount}
            </span>
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <SubmitButton variant={remove ? "destructive" : "default"}>
              {remove
                ? t("members.creditsRemoveConfirm", { count: amount })
                : t("members.creditsConfirm", { count: amount })}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
