import { formatMoney, trendChange, zonedDateKey } from "@salle/shared";
import type { Enums } from "@salle/supabase";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
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

/** Un chiffre du bandeau : libellé, valeur, précision en une ligne. */
function Stat({
  label,
  value,
  hint,
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  title?: string | undefined;
}) {
  return (
    <div className="min-w-0 px-4 py-3" title={title}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1 truncate text-xl leading-tight font-medium tabular-nums">
        {value}
      </dd>
      {hint ? <dd className="truncate text-xs text-muted-foreground">{hint}</dd> : null}
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
 * Synthèse de la fiche (accueil et gérant) : un bandeau de chiffres (ancienneté, séances, présence,
 * réservations, abonnement ou crédits, encaissé pour le gérant) et une ligne pour le dernier email.
 * Tout vient de `member_overview` ; le détail reste dans les onglets.
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
  const { loyalty, offer, finance, emails } = data as unknown as Overview;
  const format = gymFormatters(timeZone);
  const now = currentTime();
  const counted = loyalty.attended + loyalty.no_shows;
  const change = trendChange(loyalty.attended_30d, loyalty.attended_prev_30d);
  const sub = offer.subscription;
  // Jours civils de la salle : une venue d'hier soir reste « hier ».
  const daysSince = loyalty.last_visit
    ? Math.round(
        (Date.parse(zonedDateKey(now, timeZone)) -
          Date.parse(zonedDateKey(new Date(loyalty.last_visit), timeZone))) /
          DAY,
      )
    : null;
  const last = emails.last[0];
  const alert = sub && (sub.status === "past_due" || sub.status === "unpaid");

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-border">
      <dl className="grid grid-cols-2 divide-border sm:grid-cols-3 xl:grid-cols-6 xl:divide-x [&>*]:border-b xl:[&>*]:border-b-0">
        <Stat
          label={t("memberOverview.tenure")}
          value={tenure(loyalty.member_since, now)}
          hint={t("memberOverview.since", { date: format.monthYear(loyalty.member_since) })}
          title={format.fullDate(loyalty.member_since)}
        />
        <Stat
          label={t("memberOverview.last30")}
          value={
            <>
              {loyalty.attended_30d}
              {change && change.direction !== "flat" ? (
                change.direction === "up" ? (
                  <ArrowUpRightIcon aria-hidden className="size-4 text-success" />
                ) : (
                  <ArrowDownRightIcon aria-hidden className="size-4 text-destructive" />
                )
              ) : null}
            </>
          }
          hint={t("memberOverview.total", { count: loyalty.attended })}
          title={t("memberOverview.previous30", { count: loyalty.attended_prev_30d })}
        />
        <Stat
          label={t("memberOverview.presence")}
          value={counted > 0 ? percent.format(loyalty.attended / counted) : "—"}
          hint={
            daysSince === null
              ? t("memberOverview.neverCame")
              : t("memberOverview.seen", { count: daysSince })
          }
          title={t("memberOverview.noShows", { count: loyalty.no_shows })}
        />
        <Stat
          label={t("memberOverview.upcomingLabel")}
          value={loyalty.upcoming}
          hint={t("memberOverview.bookings", { count: loyalty.upcoming })}
        />
        {sub ? (
          <Stat
            label={t("memberOverview.subscription")}
            value={
              <span className={cn("truncate text-base", alert && "text-destructive")}>
                {alert ? t(`billing.subscriptionStatus.${sub.status}`) : sub.plan}
              </span>
            }
            hint={
              sub.current_period_end
                ? t(sub.cancel_at ? "memberOverview.endsOn" : "memberOverview.until", {
                    date: format.dateKey(zonedDateKey(new Date(sub.current_period_end), timeZone)),
                  })
                : t(sub.online ? "memberOverview.online" : "memberOverview.manual")
            }
            title={sub.plan}
          />
        ) : (
          <Stat
            label={t("memberOverview.credits")}
            value={offer.credits}
            hint={
              offer.next_expiry
                ? t("memberOverview.expiresOn", {
                    date: format.dateKey(zonedDateKey(new Date(offer.next_expiry), timeZone)),
                  })
                : t("memberOverview.noSubscription")
            }
          />
        )}
        {manager && finance ? (
          <Stat
            label={t("memberOverview.paid")}
            value={formatMoney(finance.total_paid_cents)}
            hint={
              finance.failed > 0 ? (
                <span className="text-destructive">
                  {t("memberOverview.failed", { count: finance.failed })}
                </span>
              ) : (
                t("memberOverview.payments", { count: finance.payments })
              )
            }
          />
        ) : null}
      </dl>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {last
            ? t("memberOverview.lastEmail", {
                subject: last.subject ?? t("memberOverview.noSubject"),
                date: format.dateTime(last.created_at),
              })
            : t("memberOverview.noEmails")}
        </span>
        <span aria-hidden>·</span>
        <span className={cn(!emails.consent_at && "text-warning")}>
          {t(emails.consent_at ? "memberOverview.consentYes" : "memberOverview.consentNo")}
        </span>
        {manager ? (
          <Link
            href={`/messages?adherent=${memberId}`}
            className="ml-auto font-medium text-primary hover:underline"
          >
            {t("memberOverview.allMessages")}
          </Link>
        ) : null}
      </p>
    </div>
  );
}
