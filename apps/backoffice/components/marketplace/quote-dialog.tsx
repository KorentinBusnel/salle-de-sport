"use client";

import { FileTextIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestQuote } from "@/app/(app)/marketplace/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";

/** Demande de devis : pour un produit ou service du catalogue (productId) ou un besoin libre. */
export function QuoteDialog({
  productId = null,
  productName,
  variant = "outline",
  label,
}: {
  productId?: string | null;
  productName?: string;
  variant?: "outline" | "default";
  label?: string;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const qty = Number.parseInt(quantity, 10);
  const valid = Number.isInteger(qty) && qty >= 1 && (productId !== null || title.trim() !== "");

  function send() {
    start(async () => {
      const result = await requestQuote({ productId, title, quantity: qty, message });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("marketplace.quote.sent"));
      setOpen(false);
      setTitle("");
      setMessage("");
      setQuantity("1");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          <FileTextIcon data-icon="inline-start" aria-hidden />
          {label ?? t("marketplace.requestQuote")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {productName
              ? t("marketplace.quote.forProduct", { name: productName })
              : t("marketplace.quote.title")}
          </DialogTitle>
          {productId === null ? (
            <DialogDescription>{t("marketplace.quote.freeHint")}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-3">
          {productId === null ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${ids}-title`}>{t("marketplace.quote.free")}</Label>
              <Input
                id={`${ids}-title`}
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-qty`}>{t("marketplace.quote.quantity")}</Label>
            <Input
              id={`${ids}-qty`}
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-32 tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-msg`}>{t("marketplace.quote.message")}</Label>
            <Textarea
              id={`${ids}-msg`}
              value={message}
              rows={4}
              maxLength={2000}
              placeholder={t("marketplace.quote.messageHint")}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={send} disabled={!valid || pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("marketplace.quote.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
