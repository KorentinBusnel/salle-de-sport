import { formatMoney, MP_QUOTE_STATUS_TONE } from "@salle/shared";
import { FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { QuoteActions } from "@/components/marketplace/order-actions";
import { QuoteDialog } from "@/components/marketplace/quote-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("marketplace.tab.quotes") };

/** Devis de la salle : demandes en attente, propositions à accepter ou refuser, historique. */
export default async function MarketplaceQuotesPage() {
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("mp_quotes")
    .select(
      "id, title, quantity, message, status, unit_price_cents, answer_note, valid_until, created_at",
    )
    .eq("gym_id", context.gym.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("marketplace.tab.quotes")}
        description={t("marketplace.quotesHint")}
        actions={<QuoteDialog label={t("marketplace.quote.newRequest")} variant="default" />}
      />
      {!quotes?.length ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("marketplace.quotes.empty")}</EmptyTitle>
            <EmptyDescription>{t("marketplace.quotes.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-3">
          {quotes.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-xl bg-card p-4 shadow-border"
            >
              <div className="grid min-w-0 flex-1 basis-64 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {q.quantity} × {q.title}
                  </span>
                  <StatusPill tone={MP_QUOTE_STATUS_TONE[q.status]}>
                    {t(`marketplace.quotes.status.${q.status}`)}
                  </StatusPill>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("marketplace.quotes.requestedOn", { date: format.dateTime(q.created_at) })}
                </span>
                {q.message ? <p className="text-sm text-muted-foreground">{q.message}</p> : null}
              </div>
              <div className="grid gap-1 text-sm">
                {q.unit_price_cents !== null ? (
                  <>
                    <span className="font-medium tabular-nums">
                      {t("marketplace.quotes.answer", {
                        price: formatMoney(q.unit_price_cents),
                        total: formatMoney(q.unit_price_cents * q.quantity),
                      })}
                    </span>
                    {q.valid_until ? (
                      <span className="text-xs text-muted-foreground">
                        {t("marketplace.quotes.validUntil", {
                          date: format.dateKey(q.valid_until),
                        })}
                      </span>
                    ) : null}
                    {q.answer_note ? (
                      <span className="text-xs text-muted-foreground">{q.answer_note}</span>
                    ) : null}
                  </>
                ) : q.status === "requested" ? (
                  <span className="text-muted-foreground">{t("marketplace.quotes.waiting")}</span>
                ) : null}
                {q.status === "answered" ? <QuoteActions id={q.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
