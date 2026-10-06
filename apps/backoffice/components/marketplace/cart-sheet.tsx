"use client";

import { formatMoney, mpNextTier, mpUnitPrice, type PriceTier } from "@salle/shared";
import { MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { checkoutCart, setCartItem } from "@/app/(app)/marketplace/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

export type CartLine = {
  productId: string;
  name: string;
  unit: string | null;
  quantity: number;
  priceCents: number;
  tiers: PriceTier[];
};

/** Panier de la salle : quantités modifiables, prix au palier atteint, commande. */
export function CartSheet({ lines }: { lines: CartLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [ordering, startOrder] = useTransition();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce(
    (sum, line) => sum + mpUnitPrice(line.priceCents, line.tiers, line.quantity) * line.quantity,
    0,
  );

  function change(productId: string, quantity: number) {
    start(async () => {
      const result = await setCartItem({ productId, quantity });
      if (!result.ok) toast.error(t(result.error), { closeButton: true });
      router.refresh();
    });
  }

  function order() {
    startOrder(async () => {
      const result = await checkoutCart();
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("marketplace.ordered"));
      setOpen(false);
      router.push("/marketplace/commandes");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={lines.length ? "default" : "outline"}>
          <ShoppingCartIcon data-icon="inline-start" aria-hidden />
          {t("marketplace.cartCount", { count })}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("marketplace.cart")}</SheetTitle>
          <SheetDescription>{t("marketplace.cartHint")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4" aria-busy={pending}>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("marketplace.cartEmpty")}</p>
          ) : (
            <ul className="grid divide-y">
              {lines.map((line) => {
                const unitPrice = mpUnitPrice(line.priceCents, line.tiers, line.quantity);
                const next = mpNextTier(line.tiers, line.quantity);
                return (
                  <li key={line.productId} className="grid gap-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium">{line.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatMoney(unitPrice)}
                          {line.unit ? ` ${t("marketplace.perUnit", { unit: line.unit })}` : ""}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(unitPrice * line.quantity)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="-1"
                        disabled={pending || line.quantity <= 1}
                        onClick={() => change(line.productId, line.quantity - 1)}
                      >
                        <MinusIcon aria-hidden />
                      </Button>
                      <span className="w-10 text-center text-sm tabular-nums">{line.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="+1"
                        disabled={pending}
                        onClick={() => change(line.productId, line.quantity + 1)}
                      >
                        <PlusIcon aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto"
                        aria-label={t("marketplace.removeOf", { name: line.name })}
                        disabled={pending}
                        onClick={() => change(line.productId, 0)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </div>
                    {next ? (
                      <p className="text-xs text-primary">
                        {t("marketplace.nextTier", { count: next.min_qty - line.quantity })}{" "}
                        {t("marketplace.nextTierPrice", {
                          price: formatMoney(next.unit_price_cents),
                        })}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SheetFooter className="border-t">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t("marketplace.total")}</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
          <Button onClick={order} disabled={lines.length === 0 || ordering} aria-busy={ordering}>
            {ordering ? <Spinner data-icon="inline-start" /> : null}
            {t("marketplace.checkout")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
