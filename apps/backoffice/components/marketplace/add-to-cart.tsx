"use client";

import { MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCartItem } from "@/app/(app)/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/** Quantité et « Ajouter » : la quantité choisie remplace celle du panier. */
export function AddToCart({
  productId,
  name,
  inCart,
}: {
  productId: string;
  name: string;
  inCart: number;
}) {
  const [quantity, setQuantity] = useState(Math.max(1, inCart));
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      const result = await setCartItem({ productId, quantity });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("marketplace.added"));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-input">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="-1"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          <MinusIcon aria-hidden />
        </Button>
        <Input
          aria-label={t("marketplace.quantity")}
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.min(10000, Math.max(1, Number.parseInt(event.target.value, 10) || 1)))
          }
          className="h-7 w-14 border-0 px-1 text-center tabular-nums shadow-none focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="+1"
          onClick={() => setQuantity((q) => Math.min(10000, q + 1))}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
      <Button
        size="sm"
        onClick={add}
        disabled={pending}
        aria-busy={pending}
        aria-label={t("marketplace.addOf", { name })}
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <ShoppingCartIcon data-icon="inline-start" aria-hidden />
        )}
        {t("marketplace.add")}
      </Button>
    </div>
  );
}
