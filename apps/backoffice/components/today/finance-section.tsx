import { formatMoney, zonedDateKey } from "@salle/shared";
import { CalculatorIcon } from "lucide-react";
import Link from "next/link";
import { UnpaidActions } from "@/components/billing/unpaid-actions";
import { HomeCard, HomeSection } from "@/components/today/home-section";
import { ShowMore } from "@/components/today/show-more";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { TeamContext } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getRenewals, getTodayFrame, getUnpaid } from "@/lib/today";

/**
 * Finance : impayés clients (accueil et gérant : relancer, encaisser sur place) ; pour le gérant,
 * abonnements suivis à la main à renouveler sous 7 jours et factures à payer (Pennylane).
 */
export async function FinanceSection({ context }: { context: TeamContext }) {
  const frame = getTodayFrame(context);
  const [unpaid, renewals] = await Promise.all([
    getUnpaid(context),
    frame.manager ? getRenewals(context) : Promise.resolve([]),
  ]);
  const format = gymFormatters(frame.tz);
  const today = Date.parse(zonedDateKey(frame.now, frame.tz));
  return (
    <HomeSection
      id="finance"
      title={t("today.finance")}
      {...(frame.manager
        ? { href: "/parametres?onglet=integrations", link: t("today.financeSources") }
        : {})}
    >
      <div className={cn("grid items-start gap-4", frame.manager && "lg:grid-cols-2")}>
        <HomeCard
          title={t("today.unpaid")}
          aside={
            unpaid.rows.length ? (
              <span className="font-semibold text-destructive tabular-nums">
                {formatMoney(unpaid.total)}
              </span>
            ) : null
          }
        >
          {unpaid.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("today.unpaidEmpty")}</p>
          ) : (
            <ShowMore
              label={t("today.unpaid")}
              className="grid gap-1"
              items={unpaid.rows.map((row) => (
                <li
                  key={row.member_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2"
                >
                  <span className="grid min-w-0 flex-1 basis-48">
                    <Link
                      href={`/adherents/${row.member_id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {row.first_name} {row.last_name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {[
                        row.plan,
                        t(row.online ? "unpaid.online" : "unpaid.onSite"),
                        t("today.since", { date: format.dateTime(row.first_failed_at) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.last_reminded_at
                        ? `${t("unpaid.reminders", { count: row.reminders })} · ${t(
                            "unpaid.lastReminder",
                            {
                              count: Math.round(
                                (today -
                                  Date.parse(
                                    zonedDateKey(new Date(row.last_reminded_at), frame.tz),
                                  )) /
                                  86_400_000,
                              ),
                            },
                          )}`
                        : t("unpaid.neverReminded")}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(row.amount_cents, row.currency)}
                  </span>
                  <UnpaidActions
                    memberId={row.member_id}
                    name={`${row.first_name} ${row.last_name}`}
                    amount={formatMoney(row.amount_cents, row.currency)}
                    subscriptionId={row.subscription_id}
                    settleable={row.settleable}
                  />
                </li>
              ))}
            />
          )}
        </HomeCard>
        {renewals.length ? (
          <HomeCard title={t("today.renewals")}>
            <ShowMore
              label={t("today.renewals")}
              className="grid gap-1"
              items={renewals.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-1.5">
                  <span className="grid min-w-0 flex-1">
                    <Link
                      href={`/adherents/${row.member_id}?onglet=paiements`}
                      className="truncate font-medium hover:underline"
                    >
                      {row.members?.first_name} {row.members?.last_name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.plans?.name}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t("today.renewBy", {
                      date: format.longDayInline(row.current_period_end ?? ""),
                    })}
                  </span>
                </li>
              ))}
            />
          </HomeCard>
        ) : null}
        {frame.manager ? (
          <HomeCard title={t("today.bills")}>
            <Empty className="rounded-lg border border-dashed p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalculatorIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t("today.billsPending")}</EmptyTitle>
                <EmptyDescription>{t("today.billsHint")}</EmptyDescription>
              </EmptyHeader>
              <Button asChild size="sm" variant="outline">
                <Link href="/parametres?onglet=integrations">{t("today.connect")}</Link>
              </Button>
            </Empty>
          </HomeCard>
        ) : null}
      </div>
    </HomeSection>
  );
}
