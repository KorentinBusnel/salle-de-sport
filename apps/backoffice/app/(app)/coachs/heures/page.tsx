import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type HoursRow, HoursTable } from "@/components/coaches/hours-table";
import { MonthNav } from "@/components/forms/month-nav";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isManagerRole, requireTeamContext } from "@/lib/auth";
import { loadCoachHours, loadMonthSessions } from "@/lib/coach-hours";
import { currentMonthKey } from "@/lib/coaches";
import { euros, gymFormatters, hoursLabel } from "@/lib/format";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("hours.title") };

/**
 * Heures réalisées du mois : tous les coachs en lignes dépliables, total collant (gérant), ou
 * les siennes (coach).
 */
export default async function CoachHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; coach?: string }>;
}) {
  const params = await searchParams;
  const context = await requireTeamContext();
  const manager = isManagerRole(context.role);
  const month = params.mois ?? currentMonthKey(context);
  const coachId = manager && params.coach ? params.coach : undefined;
  const data = await loadCoachHours(context, month, manager ? undefined : coachId);
  if (!data) notFound();
  const { range, summary, line, sessions } = data;
  const monthSessions = manager ? await loadMonthSessions(context, range) : {};
  const format = gymFormatters(context.gym.timezone);

  const exportHref = (coach?: string) =>
    `/coachs/heures/export?${new URLSearchParams({ mois: month, ...(coach ? { coach } : {}) })}`;
  const total = summary.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      minutes: acc.minutes + r.minutes,
      amount: acc.amount + (r.amount_cents ?? 0),
    }),
    { sessions: 0, minutes: 0, amount: 0 },
  );
  const showDetail = Boolean(line) && !manager;
  const rows: HoursRow[] = summary.map((r) => ({
    coachId: r.coach_id,
    name: r.display_name,
    sessions: r.sessions,
    hours: hoursLabel(r.minutes),
    rate: r.hourly_rate_cents === null ? "—" : euros(r.hourly_rate_cents),
    amount: r.amount_cents === null ? "—" : euros(r.amount_cents),
    exportHref: exportHref(r.coach_id),
    detail: (monthSessions[r.coach_id] ?? []).map((s) => ({
      id: s.id,
      day: format.shortDay(s.starts_at),
      time: `${format.time(s.starts_at)} – ${format.time(s.ends_at)}`,
      discipline: s.discipline,
      hours: hoursLabel(s.minutes),
    })),
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title={manager ? t("hours.title") : t("nav.myHours")}
        description={t("hours.hint")}
        actions={
          <>
            <MonthNav month={month} previous={range.previous} next={range.next} />
            <Button asChild>
              <a href={exportHref(showDetail ? line?.coach_id : undefined)} download>
                <DownloadIcon data-icon="inline-start" />
                {t(manager ? "hours.exportAll" : "hours.export")}
              </a>
            </Button>
          </>
        }
      />

      {manager ? (
        <HoursTable
          rows={rows}
          total={{
            sessions: total.sessions,
            hours: hoursLabel(total.minutes),
            amount: euros(total.amount),
          }}
          initialOpen={coachId}
        />
      ) : null}

      {showDetail && line ? (
        <section className="grid gap-3" aria-labelledby="detail-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="detail-title" className="text-lg font-semibold">
              {manager ? line.display_name : t("hours.mySessions")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("hours.summary", {
                count: line.sessions,
                hours: hoursLabel(line.minutes),
                amount: line.amount_cents === null ? "—" : euros(line.amount_cents),
              })}
            </p>
          </div>
          {sessions.length ? (
            <ul className="divide-y overflow-hidden rounded-xl bg-card text-sm shadow-border">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-28 text-muted-foreground">{format.shortDay(s.starts_at)}</span>
                  <span className="w-28 tabular-nums">
                    {format.time(s.starts_at)} – {format.time(s.ends_at)}
                  </span>
                  <span className="flex-1">{s.discipline}</span>
                  <span className="tabular-nums">{hoursLabel(s.minutes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("hours.none")}</p>
          )}
        </section>
      ) : null}
      {!manager && !line ? <p className="text-muted-foreground">{t("hours.noCoach")}</p> : null}
    </div>
  );
}
