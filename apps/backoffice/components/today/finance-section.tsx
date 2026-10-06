import { CalculatorIcon } from "lucide-react";
import Link from "next/link";
import { AssistantButton } from "@/components/today/assistant-button";
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
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getTodayFrame, getUnpaid } from "@/lib/today";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Finance (gérant) : impayés clients, factures à payer (Pennylane, à brancher). */
export async function FinanceSection({ context }: { context: TeamContext }) {
  const frame = getTodayFrame(context);
  const unpaid = await getUnpaid(context);
  const configured = aiEnv().apiKey !== null;
  const format = gymFormatters(frame.tz);
  return (
    <HomeSection
      id="finance"
      title={t("today.finance")}
      href="/parametres?onglet=integrations"
      link={t("today.financeSources")}
    >
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <HomeCard
          title={t("today.unpaid")}
          aside={
            unpaid.rows.length ? (
              <span className="font-semibold text-destructive tabular-nums">
                {money.format(unpaid.total / 100)}
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
                <li key={row.member_id} className="flex items-center gap-3 py-1.5">
                  <span className="grid min-w-0 flex-1">
                    <Link
                      href={`/adherents/${row.member_id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {row.first_name} {row.last_name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {[
                        row.plan,
                        t("today.failures", { count: row.failures }),
                        t("today.since", { date: format.dateTime(row.first_failed_at) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {money.format(row.amount_cents / 100)}
                  </span>
                  {configured ? (
                    <AssistantButton
                      size="sm"
                      variant="outline"
                      prompt={t("today.unpaidPrompt", {
                        name: `${row.first_name} ${row.last_name}`,
                        id: row.member_id,
                        amount: money.format(row.amount_cents / 100),
                        count: row.failures,
                      })}
                    >
                      {t("today.remind")}
                    </AssistantButton>
                  ) : null}
                </li>
              ))}
            />
          )}
        </HomeCard>
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
      </div>
    </HomeSection>
  );
}
