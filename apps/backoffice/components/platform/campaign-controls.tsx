"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelCampaign, closeCampaign, createCampaign } from "@/app/(app)/plateforme/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
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
      if (result.message) toast.success(t(result.message, { count: result.count ?? 0 }));
      onDone?.();
      router.refresh();
    });
  return { pending, run };
}

/** Nouvel achat groupé : produit, titre, date de clôture, minimum. */
export function NewCampaign({
  products,
  defaultEndsOn,
}: {
  products: { id: string; name: string }[];
  defaultEndsOn: string;
}) {
  const ids = useId();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [endsOn, setEndsOn] = useState(defaultEndsOn);
  const [minQty, setMinQty] = useState("10");
  const { pending, run } = useRun();
  const min = Number.parseInt(minQty, 10);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor={`${ids}-product`}>{t("platform.campaigns.product")}</Label>
        <NativeSelect
          id={`${ids}-product`}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="w-60"
        >
          {products.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${ids}-title`}>{t("platform.campaigns.titleField")}</Label>
        <Input
          id={`${ids}-title`}
          value={title}
          maxLength={120}
          placeholder={t("platform.campaigns.titlePlaceholder")}
          onChange={(event) => setTitle(event.target.value)}
          className="w-56"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${ids}-ends`}>{t("platform.campaigns.endsOn")}</Label>
        <Input
          id={`${ids}-ends`}
          type="date"
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          className="w-40"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${ids}-min`}>{t("platform.campaigns.minQty")}</Label>
        <Input
          id={`${ids}-min`}
          inputMode="numeric"
          value={minQty}
          onChange={(event) => setMinQty(event.target.value.replace(/\D/g, ""))}
          className="w-24 tabular-nums"
        />
      </div>
      <Button
        disabled={pending || !productId || !endsOn || !Number.isInteger(min) || min < 1}
        aria-busy={pending}
        onClick={() =>
          run(
            () => createCampaign({ productId, endsOn, minQty: min, title }),
            () => setTitle(""),
          )
        }
      >
        {pending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <PlusIcon data-icon="inline-start" aria-hidden />
        )}
        {t("platform.campaigns.create")}
      </Button>
    </div>
  );
}

/** Achat groupé ouvert : clôturer et débiter (confirmation), ou annuler sans débit. */
export function CampaignActions({ id, title }: { id: string; title: string }) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState<"close" | "cancel" | null>(null);
  const done = (resolve: () => void) => () => {
    setConfirm(null);
    resolve();
  };
  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" onClick={() => setConfirm("close")} disabled={pending}>
        {t("platform.campaigns.close")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm("cancel")} disabled={pending}>
        {t("platform.campaigns.cancel")}
      </Button>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t(
          confirm === "cancel" ? "platform.campaigns.cancelTitle" : "platform.campaigns.closeTitle",
          { title },
        )}
        description={t(
          confirm === "cancel" ? "platform.campaigns.cancelBody" : "platform.campaigns.closeBody",
        )}
        confirmLabel={t(
          confirm === "cancel" ? "platform.campaigns.cancel" : "platform.campaigns.close",
        )}
        action={() =>
          new Promise<void>((resolve) =>
            run(
              () => (confirm === "cancel" ? cancelCampaign({ id }) : closeCampaign({ id })),
              done(resolve),
            ),
          )
        }
      />
    </div>
  );
}
