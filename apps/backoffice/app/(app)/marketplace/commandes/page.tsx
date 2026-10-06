import { formatMoney, MP_ORDER_STATUS_TONE } from "@salle/shared";
import { ReceiptIcon } from "lucide-react";
import type { Metadata } from "next";
import { MarketplaceNav } from "@/components/marketplace/marketplace-nav";
import { OrderActions } from "@/components/marketplace/order-actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("marketplace.tab.orders") };

/** Commandes de la salle à la marketplace : statut de suivi, annulation, réception. */
export default async function MarketplaceOrdersPage() {
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("mp_orders")
    .select(
      "id, reference, status, total_cents, currency, created_at, mp_order_items(name, quantity)",
    )
    .eq("gym_id", context.gym.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="grid gap-6">
      <PageHeader title={t("marketplace.title")} description={t("marketplace.hint")} />
      <MarketplaceNav current="/marketplace/commandes" />
      {!orders?.length ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("marketplace.orders.empty")}</EmptyTitle>
            <EmptyDescription>{t("marketplace.orders.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card shadow-border">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">{t("marketplace.orders.reference")}</TableHead>
                <TableHead>{t("marketplace.orders.items")}</TableHead>
                <TableHead>{t("marketplace.orders.status")}</TableHead>
                <TableHead className="text-right">{t("marketplace.orders.total")}</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">{t("marketplace.orders.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4">
                    <span className="block font-medium">{o.reference}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format.dateTime(o.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-80">
                    <span className="block truncate text-sm">
                      {o.mp_order_items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("marketplace.orders.itemCount", { count: o.mp_order_items.length })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={MP_ORDER_STATUS_TONE[o.status]}>
                      {t(`marketplace.orders.statusLabel.${o.status}`)}
                    </StatusPill>
                    {o.status === "pending_payment" ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("marketplace.orders.payLater")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(o.total_cents, o.currency)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <OrderActions
                      id={o.id}
                      reference={o.reference}
                      canCancel={o.status === "pending_payment"}
                      canReceive={o.status === "shipped" || o.status === "delivered"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
