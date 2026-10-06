"use client";

import { formatMoney } from "@salle/shared";
import { UsersRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { commitCampaign, withdrawCommitment } from "@/app/(app)/marketplace/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

export type GroupBuy = {
  id: string;
  title: string;
  description: string | null;
  productName: string;
  unit: string | null;
  listPriceCents: number | null;
  endsLabel: string;
  minQty: number;
  totalQty: number;
  gyms: number;
  unitPriceCents: number;
  nextMinQty: number | null;
  nextUnitPriceCents: number | null;
  mine: { id: string; quantity: number; status: string } | null;
};

/** Achat groupé : progression vers le palier suivant et engagement de la salle. */
function GroupBuyCard({ campaign }: { campaign: GroupBuy }) {
  const router = useRouter();
  const ids = useId();
  const [quantity, setQuantity] = useState(String(campaign.mine?.quantity ?? 1));
  const [pending, start] = useTransition();
  const mine = campaign.mine;
  const target = campaign.totalQty < campaign.minQty ? campaign.minQty : campaign.nextMinQty;
  const value = Number.parseInt(quantity, 10);

  const commit = () =>
    start(async () => {
      const result = await commitCampaign({ campaignId: campaign.id, quantity: value });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      // Carte à enregistrer : direction Stripe Checkout (aucun débit avant la clôture).
      if (result.data.url) {
        window.location.assign(result.data.url);
        return;
      }
      if (result.message) toast.success(t(result.message));
      router.refresh();
    });

  const withdraw = () =>
    start(async () => {
      if (!mine) return;
      const result = await withdrawCommitment({ id: mine.id });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      if (result.message) toast.success(t(result.message));
      router.refresh();
    });

  return (
    <article className="grid gap-3 rounded-xl bg-card p-4 shadow-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{campaign.title}</h3>
          <p className="text-xs text-muted-foreground">
            {campaign.unit ? `${campaign.productName} · ${campaign.unit}` : campaign.productName}
            {" · "}
            {t("marketplace.groupBuy.endsOn", { date: campaign.endsLabel })}
          </p>
        </div>
        {mine ? (
          <Badge variant={mine.status === "committed" ? "default" : "secondary"}>
            {t(
              `marketplace.groupBuy.status.${mine.status}` as "marketplace.groupBuy.status.committed",
            )}
          </Badge>
        ) : null}
      </div>
      {campaign.description ? (
        <p className="text-sm text-muted-foreground">{campaign.description}</p>
      ) : null}

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="tabular-nums">
            <span className="text-lg font-medium">{formatMoney(campaign.unitPriceCents)}</span>{" "}
            {campaign.listPriceCents ? (
              <span className="text-muted-foreground line-through">
                {formatMoney(campaign.listPriceCents)}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <UsersRoundIcon aria-hidden className="size-3.5" />
            {t("marketplace.groupBuy.gyms", { count: campaign.gyms })}
          </span>
        </div>
        <Progress
          value={target ? Math.min(100, (campaign.totalQty / target) * 100) : 100}
          aria-label={t("marketplace.groupBuy.progress")}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("marketplace.groupBuy.committed", { count: campaign.totalQty })}
          {" · "}
          {campaign.totalQty < campaign.minQty
            ? t("marketplace.groupBuy.minimum", { count: campaign.minQty })
            : campaign.nextMinQty !== null && campaign.nextUnitPriceCents !== null
              ? t("marketplace.groupBuy.nextTier", {
                  count: campaign.nextMinQty,
                  price: formatMoney(campaign.nextUnitPriceCents),
                })
              : t("marketplace.groupBuy.bestTier")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${ids}-qty`} className="text-xs">
            {t("marketplace.quantity")}
          </Label>
          <Input
            id={`${ids}-qty`}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))}
            className="w-24 tabular-nums"
          />
        </div>
        <Button
          size="sm"
          onClick={commit}
          disabled={pending || !Number.isInteger(value) || value < 1}
          aria-busy={pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {!mine
            ? t("marketplace.groupBuy.commit")
            : mine.status === "pending_card"
              ? t("marketplace.groupBuy.saveCard")
              : t("marketplace.groupBuy.update")}
        </Button>
        {mine ? (
          <Button size="sm" variant="ghost" onClick={withdraw} disabled={pending}>
            {t("marketplace.groupBuy.withdraw")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("marketplace.groupBuy.hint")}</p>
    </article>
  );
}

/** Bandeau « Achats groupés » du catalogue (campagnes ouvertes). */
export function GroupBuys({ campaigns }: { campaigns: GroupBuy[] }) {
  if (campaigns.length === 0) return null;
  return (
    <section aria-labelledby="achats-groupes" className="grid gap-3">
      <div>
        <h2 id="achats-groupes" className="font-medium">
          {t("marketplace.groupBuy.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("marketplace.groupBuy.intro")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => (
          <GroupBuyCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </section>
  );
}
