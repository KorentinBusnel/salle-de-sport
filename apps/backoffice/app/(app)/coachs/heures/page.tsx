import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isManagerRole, requireTeamContext } from "@/lib/auth";
import { loadCoachHours } from "@/lib/coach-hours";
import { currentMonthKey } from "@/lib/coaches";
import { euros, gymFormatters, hoursLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("hours.title") };

/** Heures réalisées du mois : tous les coachs (gérant), ou les siennes (coach). */
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
  const data = await loadCoachHours(context, month, coachId);
  if (!data) notFound();
  const { range, summary, line, sessions } = data;
  const format = gymFormatters(context.gym.timezone);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${range.from}T12:00:00Z`));

  const link = (overrides: { mois?: string; coach?: string | null }) => {
    const query = new URLSearchParams({ mois: overrides.mois ?? month });
    const coach = overrides.coach === undefined ? coachId : overrides.coach;
    if (coach) query.set("coach", coach);
    return `?${query.toString()}`;
  };
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
  const showDetail = Boolean(line) && (coachId !== undefined || !manager);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={manager ? t("hours.title") : t("nav.myHours")}
        description={t("hours.hint")}
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button asChild variant="outline" size="icon-sm">
                <Link href={link({ mois: range.previous })} aria-label={t("hours.previousMonth")}>
                  <ChevronLeftIcon />
                </Link>
              </Button>
              <span className="min-w-36 text-center font-medium capitalize">{monthLabel}</span>
              <Button asChild variant="outline" size="icon-sm">
                <Link href={link({ mois: range.next })} aria-label={t("hours.nextMonth")}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            </div>
            <Button asChild>
              <a href={exportHref(showDetail ? line?.coach_id : undefined)} download>
                <DownloadIcon data-icon="inline-start" />
                {t("hours.export")}
              </a>
            </Button>
          </>
        }
      />

      {manager ? (
        <div className="overflow-hidden rounded-xl bg-card shadow-border">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">{t("coaches.name")}</TableHead>
                <TableHead className="text-right">{t("hours.sessions")}</TableHead>
                <TableHead className="text-right">{t("hours.hours")}</TableHead>
                <TableHead className="text-right">{t("hours.rate")}</TableHead>
                <TableHead className="pr-4 text-right">{t("hours.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((r) => (
                <TableRow key={r.coach_id} className={cn(r.coach_id === coachId && "bg-accent/50")}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={link({ coach: r.coach_id === coachId ? null : r.coach_id })}
                      className="hover:underline"
                    >
                      {r.display_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{hoursLabel(r.minutes)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.hourly_rate_cents === null ? "—" : euros(r.hourly_rate_cents)}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-medium tabular-nums">
                    {r.amount_cents === null ? "—" : euros(r.amount_cents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">{t("hours.total")}</TableCell>
                <TableCell className="text-right tabular-nums">{total.sessions}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {hoursLabel(total.minutes)}
                </TableCell>
                <TableCell />
                <TableCell className="pr-4 text-right tabular-nums">
                  {euros(total.amount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
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
