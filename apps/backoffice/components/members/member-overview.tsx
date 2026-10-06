import { formatMoney, SUBSCRIPTION_STATUS_TONE, trendChange, zonedDateKey } from "@salle/shared";
import type { Enums } from "@salle/supabase";
import { ArrowDownRightIcon, ArrowUpRightIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/status-pill";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Résultat de la fonction SQL member_overview (calculs faits en base). */
type Overview = {
  loyalty: {
    member_since: string;
    attended: number;
    no_shows: number;
    attended_30d: number;
    attended_prev_30d: number;
    first_visit: string | null;
    last_visit: string | null;
    upcoming: number;
  };
  offer: {
    subscription: {
      plan: string;
      type: Enums<"plan_type">;
      status: Enums<"subscription_status">;
      current_period_end: string | null;
      commitment_ends_at: string | null;
      cancel_at: string | null;
      online: boolean;
    } | null;
    credits: number;
    next_expiry: string | null;
    last_plan: string | null;
  };
  /** Gérant seulement. */
  finance: {
    total_paid_cents: number;
    payments: number;
    failed: number;
    last_payment_at: string | null;
  } | null;
  emails: {
    consent_at: string | null;
    last: {
      id: string;
      subject: string | null;
      origin: Enums<"message_origin">;
      status: Enums<"message_status">;
      created_at: string;
    }[];
  };
};

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const DAY = 86_400_000;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-border">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <p className="text-2xl leading-tight font-medium tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Ancienneté : en mois la première année, puis en années. */
function tenure(since: string, now: Date): string {
  const start = new Date(since);
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  return months < 12
    ? t("memberOverview.tenureMonths", { count: Math.max(0, months) })
    : t("memberOverview.tenureYears", { count: Math.floor(months / 12) });
}

/**
 * Synthèse de la fiche (accueil et gérant) : fidélité, offre et crédits, paiements (gérant),
 * derniers emails. Tout vient de `member_overview` ; rien n'est recalculé ici.
 */
export async function MemberOverview({
  memberId,
  timeZone,
  manager,
}: {
  memberId: string;
  timeZone: string;
  manager: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_overview", { p_member_id: memberId });
  if (error) throw new Error(error.message);
  const overview = data as unknown as Overview;
  const { loyalty, offer, finance, emails } = overview;
  const format = gymFormatters(timeZone);
  const now = currentTime();
  const counted = loyalty.attended + loyalty.no_shows;
  const change = trendChange(loyalty.attended_30d, loyalty.attended_prev_30d);
  const sub = offer.subscription;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
      <Block title={t("memberOverview.loyalty")}>
        <p className="text-sm" title={format.fullDate(loyalty.member_since)}>
          {t("memberOverview.since", { date: format.monthYear(loyalty.member_since) })}
          <span className="text-muted-foreground"> · {tenure(loyalty.member_since, now)}</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Figure
            value={loyalty.attended}
            label={t("memberOverview.attended", { count: loyalty.attended })}
          />
          <div title={t("memberOverview.previous30", { count: loyalty.attended_prev_30d })}>
            <p className="flex items-center gap-1 text-2xl leading-tight font-medium tabular-nums">
              {loyalty.attended_30d}
              {change && change.direction !== "flat" ? (
                change.direction === "up" ? (
                  <ArrowUpRightIcon aria-hidden className="size-4 text-success" />
                ) : (
                  <ArrowDownRightIcon aria-hidden className="size-4 text-destructive" />
                )
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{t("memberOverview.last30")}</p>
          </div>
          {counted > 0 ? (
            <div title={t("memberOverview.noShows", { count: loyalty.no_shows })}>
              <Figure
                value={percent.format(loyalty.attended / counted)}
                label={t("memberOverview.presence")}
              />
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          <span
            title={
              loyalty.last_visit
                ? t("memberOverview.lastVisit", {
                    date: format.longDayInline(loyalty.last_visit),
                  })
                : undefined
            }
          >
            {loyalty.last_visit
              ? t("memberOverview.seen", {
                  // Jours civils de la salle : une venue d'hier soir reste « hier ».
                  count: Math.round(
                    (Date.parse(zonedDateKey(now, timeZone)) -
                      Date.parse(zonedDateKey(new Date(loyalty.last_visit), timeZone))) /
                      DAY,
                  ),
                })
              : t("memberOverview.neverCame")}
          </span>
          {" · "}
          {t("memberOverview.upcoming", { count: loyalty.upcoming })}
        </p>
      </Block>

      <Block title={t("memberOverview.offer")}>
        {sub ? (
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{sub.plan}</span>
              <StatusPill tone={SUBSCRIPTION_STATUS_TONE[sub.status]}>
                {t(`billing.subscriptionStatus.${sub.status}`)}
              </StatusPill>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`offers.type.${sub.type}`)} ·{" "}
              {t(sub.online ? "memberOverview.online" : "memberOverview.manual")}
            </p>
            {sub.current_period_end ? (
              <p className="text-sm">
                {t(sub.cancel_at ? "billing.endsOn" : "billing.periodEnd", {
                  date: format.longDayInline(sub.current_period_end),
                })}
              </p>
            ) : null}
            {sub.commitment_ends_at && Date.parse(sub.commitment_ends_at) > now.getTime() ? (
              <p className="text-sm text-muted-foreground">
                {t("billing.commitmentUntil", {
                  date: format.longDayInline(sub.commitment_ends_at),
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-1">
            <span className="font-medium">{t("memberOverview.noSubscription")}</span>
            {offer.last_plan ? (
              <p className="text-sm text-muted-foreground">
                {t("memberOverview.lastPlan", { plan: offer.last_plan })}
              </p>
            ) : null}
          </div>
        )}
        <Figure
          value={offer.credits}
          label={
            offer.next_expiry
              ? t("memberOverview.creditsExpiring", {
                  date: format.longDayInline(offer.next_expiry),
                })
              : t("memberOverview.credits")
          }
        />
      </Block>

      {manager && finance ? (
        <Block title={t("memberOverview.finance")}>
          <Figure
            value={formatMoney(finance.total_paid_cents)}
            label={t("memberOverview.payments", { count: finance.payments })}
          />
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {finance.last_payment_at ? (
              <li>
                {t("memberOverview.lastPayment", {
                  date: format.longDayInline(finance.last_payment_at),
                })}
              </li>
            ) : null}
            {finance.failed > 0 ? (
              <li className="text-destructive">
                {t("memberOverview.failed", { count: finance.failed })}
              </li>
            ) : null}
          </ul>
          <Link
            href={`/adherents/${memberId}?onglet=paiements`}
            className="mt-auto text-sm font-medium text-primary hover:underline"
          >
            {t("memberOverview.seePayments")}
          </Link>
        </Block>
      ) : null}

      <Block title={t("memberOverview.emails")}>
        {emails.last.length ? (
          <ul className="grid gap-2">
            {emails.last.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-sm">
                <MailIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {m.subject ?? t("memberOverview.noSubject")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`messages.origins.${m.origin}`)} · {format.dateTime(m.created_at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("memberOverview.noEmails")}</p>
        )}
        <p className={cn("text-xs", emails.consent_at ? "text-muted-foreground" : "text-warning")}>
          {emails.consent_at
            ? t("memberOverview.consentYes", { date: format.fullDate(emails.consent_at) })
            : t("memberOverview.consentNo")}
        </p>
        {manager ? (
          <Link
            href={`/messages?adherent=${memberId}`}
            className="mt-auto text-sm font-medium text-primary hover:underline"
          >
            {t("memberOverview.allMessages")}
          </Link>
        ) : null}
      </Block>
    </div>
  );
}
