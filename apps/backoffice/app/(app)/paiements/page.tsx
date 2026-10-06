import {
  dateRangePreset,
  formatMoney,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  zonedDateKey,
  zonedStartOfDateKey,
} from "@salle/shared";
import { CreditCardIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { SortHead } from "@/components/data-table/sort-head";
import { PageHeader } from "@/components/page-header";
import { PaymentsFilters } from "@/components/payments/payments-filters";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
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
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pageSizeOf } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("payments.title") };

const TONE = {
  succeeded: "success",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
} as const;
const SORTS = ["date", "date_asc", "amount", "amount_asc"] as const;

/**
 * Paiements de la salle (gérant) : ventes sur place et paiements en ligne d'une période,
 * filtres appliqués aussitôt, tri par date ou montant, totaux, export CSV journalisé.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    du?: string;
    au?: string;
    statut?: string;
    moyen?: string;
    tri?: string;
    page?: string;
    taille?: string;
  }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const tz = context.gym.timezone;
  const format = gymFormatters(tz);
  const today = zonedDateKey(currentTime(), tz);
  const fallback = dateRangePreset("last30", today);
  const valid =
    z.iso.date().safeParse(params.du).success && z.iso.date().safeParse(params.au).success;
  const from = valid && params.du! <= params.au! ? params.du! : fallback.from;
  const to = valid && params.du! <= params.au! ? params.au! : fallback.to;
  const status = PAYMENT_STATUSES.find((s) => s === params.statut) ?? null;
  const method = PAYMENT_METHODS.find((m) => m === params.moyen) ?? null;
  const sort = SORTS.find((s) => s === params.tri) ?? "date";
  const size = pageSizeOf(params.taille);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const start = zonedStartOfDateKey(from, tz).toISOString();
  const end = zonedStartOfDateKey(
    new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
    tz,
  ).toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(
      "id, amount_cents, currency, status, method, description, paid_at, created_at, members(id, first_name, last_name), plans(name), promo_codes(code)",
      { count: "exact" },
    )
    .eq("gym_id", context.gym.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order(sort.startsWith("amount") ? "amount_cents" : "created_at", {
      ascending: sort.endsWith("_asc"),
    })
    .range((page - 1) * size, page * size - 1);
  if (status) query = query.eq("status", status);
  if (method) query = query.eq("method", method);
  let totals = supabase
    .from("payments")
    .select("amount_cents, status")
    .eq("gym_id", context.gym.id)
    .gte("created_at", start)
    .lt("created_at", end);
  if (method) totals = totals.eq("method", method);
  const [{ data: payments, count, error }, { data: all }] = await Promise.all([query, totals]);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const sum = (s: string) =>
    (all ?? []).filter((p) => p.status === s).reduce((acc, p) => acc + p.amount_cents, 0);

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({
      du: params.du ?? null,
      au: params.au ?? null,
      statut: status,
      moyen: method,
      tri: sort === "date" ? null : sort,
      taille: params.taille ?? null,
      ...changes,
    }))
      if (v) next.set(k, v);
    const text = next.toString();
    return `/paiements${text ? `?${text}` : ""}`;
  };

  return (
    <UrlStateProvider>
      <div className="grid gap-6">
        <PageHeader
          title={t("payments.title")}
          description={t("payments.period", {
            from: format.dateKey(from),
            to: format.dateKey(to),
          })}
          actions={
            <Button asChild variant="outline">
              <a href={`/api/paiements/export?du=${from}&au=${to}`} download>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                {t("payments.export")}
              </a>
            </Button>
          }
        />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(["succeeded", "failed", "refunded"] as const).map((s) => (
            <div key={s} className="rounded-xl bg-card px-4 py-3 shadow-border">
              <dt className="text-sm text-muted-foreground">{t(`payments.totals.${s}`)}</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatMoney(sum(s))}</dd>
            </div>
          ))}
        </dl>

        <PaymentsFilters
          from={from}
          to={to}
          todayKey={today}
          status={status}
          method={method}
          statuses={PAYMENT_STATUSES}
          methods={PAYMENT_METHODS}
        />

        <PendingRegion>
          {!payments?.length ? (
            <Empty className="rounded-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CreditCardIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t("payments.empty")}</EmptyTitle>
                <EmptyDescription>{t("payments.emptyHint")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-card shadow-border">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <SortHead
                      className="pl-4"
                      label={t("payments.date")}
                      href={href({ tri: sort === "date" ? "date_asc" : null, page: null })}
                      direction={sort === "date" ? "desc" : sort === "date_asc" ? "asc" : null}
                    />
                    <TableHead>{t("payments.member")}</TableHead>
                    <TableHead>{t("payments.what")}</TableHead>
                    <TableHead>{t("payments.method")}</TableHead>
                    <TableHead>{t("payments.status")}</TableHead>
                    <SortHead
                      className="pr-4 text-right"
                      label={t("payments.amount")}
                      href={href({ tri: sort === "amount" ? "amount_asc" : "amount", page: null })}
                      direction={sort === "amount" ? "desc" : sort === "amount_asc" ? "asc" : null}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground tabular-nums">
                        {format.dateTime(p.paid_at ?? p.created_at)}
                      </TableCell>
                      <TableCell>
                        {p.members ? (
                          <Link
                            href={`/adherents/${p.members.id}?onglet=paiements`}
                            className="font-medium hover:underline"
                          >
                            {p.members.first_name} {p.members.last_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-64">
                        <span className="block truncate">
                          {p.plans?.name ?? p.description ?? "—"}
                        </span>
                        {p.promo_codes ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {p.promo_codes.code}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t(`billing.methodLabel.${p.method}`)}
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={TONE[p.status]}>
                          {t(`billing.paymentStatus.${p.status}`)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">
                        {formatMoney(p.amount_cents, p.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </PendingRegion>

        {total > 0 ? (
          <DataTablePagination
            page={page}
            pages={pages}
            total={total}
            size={size}
            hrefFor={(n) => href({ page: n > 1 ? String(n) : null })}
          />
        ) : null}
      </div>
    </UrlStateProvider>
  );
}
