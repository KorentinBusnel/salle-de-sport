"use client";

import { formatMoney } from "@salle/shared";
import { ImageUpIcon, LayersIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  answerQuote,
  saveTiers,
  setOrderStatus,
  uploadProductImage,
} from "@/app/(app)/plateforme/actions";
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

/** Paliers de volume d'un produit : lignes « dès N : prix », enregistrées en bloc. */
export function TiersDialog({
  productId,
  name,
  tiers,
}: {
  productId: string;
  name: string;
  tiers: { min_qty: number; unit_price_cents: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() =>
    tiers.map((tier) => ({
      qty: String(tier.min_qty),
      price: String(tier.unit_price_cents / 100),
    })),
  );
  const { pending, run } = useRun();
  const summary = tiers.length
    ? tiers.map((tier) => `${tier.min_qty} : ${formatMoney(tier.unit_price_cents)}`).join(" · ")
    : t("platform.noTiers");

  function save() {
    const parsed = rows
      .filter((row) => row.qty.trim() !== "")
      .map((row) => ({
        min_qty: Number.parseInt(row.qty, 10),
        price: Number.parseFloat(row.price.replace(",", ".")),
      }));
    run(
      () => saveTiers({ productId, tiers: parsed }),
      () => setOpen(false),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-56 justify-start">
          <LayersIcon data-icon="inline-start" aria-hidden />
          <span className="truncate tabular-nums">{summary}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("platform.tiersTitle", { name })}</DialogTitle>
          <DialogDescription>{t("platform.tiersHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={t("platform.tierQty")}
                inputMode="numeric"
                value={row.qty}
                placeholder={t("platform.tierQty")}
                onChange={(event) =>
                  setRows((all) =>
                    all.map((r, i) => (i === index ? { ...r, qty: event.target.value } : r)),
                  )
                }
                className="w-28 tabular-nums"
              />
              <Input
                aria-label={t("platform.tierPrice")}
                inputMode="decimal"
                value={row.price}
                placeholder={t("platform.tierPrice")}
                onChange={(event) =>
                  setRows((all) =>
                    all.map((r, i) => (i === index ? { ...r, price: event.target.value } : r)),
                  )
                }
                className="w-32 tabular-nums"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("platform.removeTier")}
                onClick={() => setRows((all) => all.filter((_, i) => i !== index))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setRows((all) => [...all, { qty: "", price: "" }])}
            disabled={rows.length >= 10}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {t("platform.addTier")}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Image d'un produit : choix du fichier, envoi aussitôt. */
export function ImageUpload({ productId, name }: { productId: string; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useRun();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const data = new FormData();
          data.set("productId", productId);
          data.set("file", file);
          run(() => uploadProductImage(data));
          event.target.value = "";
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("platform.imageOf", { name })}
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        {pending ? <Spinner /> : <ImageUpIcon aria-hidden />}
      </Button>
    </>
  );
}

/** Réponse à une demande de devis. */
export function AnswerQuote({
  quoteId,
  defaultPrice,
  defaultUntil,
}: {
  quoteId: string;
  defaultPrice: number | null;
  defaultUntil: string;
}) {
  const ids = useId();
  const [price, setPrice] = useState(defaultPrice !== null ? String(defaultPrice / 100) : "");
  const [until, setUntil] = useState(defaultUntil);
  const [note, setNote] = useState("");
  const { pending, run } = useRun();
  const value = Number.parseFloat(price.replace(",", "."));
  return (
    <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${ids}-price`}>{t("platform.unitPrice")}</Label>
          <Input
            id={`${ids}-price`}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="w-32 tabular-nums"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${ids}-until`}>{t("platform.validUntil")}</Label>
          <Input
            id={`${ids}-until`}
            type="date"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            className="w-40"
          />
        </div>
      </div>
      <Textarea
        aria-label={t("platform.answerNote")}
        placeholder={t("platform.answerNote")}
        value={note}
        rows={2}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        size="sm"
        className="w-fit"
        disabled={pending || !Number.isFinite(value) || value < 0 || !until}
        aria-busy={pending}
        onClick={() =>
          run(() => answerQuote({ quoteId, unitPrice: value, validUntil: until, note }))
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {t("platform.sendAnswer")}
      </Button>
    </div>
  );
}

const NEXT: Record<string, string | undefined> = {
  pending_payment: "paid",
  paid: "ordered",
  ordered: "shipped",
  shipped: "delivered",
};

/** Suivi d'une commande : étape suivante, ou annulation. */
export function OrderStatusButtons({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun();
  const next = NEXT[status];
  if (status === "received" || status === "cancelled" || status === "delivered") return null;
  return (
    <div className="flex justify-end gap-1.5">
      {next ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setOrderStatus({ id, status: next }))}
        >
          {t(`platform.markAs.${next as "paid" | "ordered" | "shipped" | "delivered"}`)}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => setOrderStatus({ id, status: "cancelled" }))}
      >
        {t("platform.cancelOrder")}
      </Button>
    </div>
  );
}
