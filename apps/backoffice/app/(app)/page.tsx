import { canSeeFinancials, isStaffRole, sessionPhase, zonedDayRange } from "@salle/shared";
import {
  CalendarCheckIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  GaugeIcon,
  HourglassIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/kpi-card";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { CalendarXIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("nav.today") };

export default async function DashboardPage() {
  const context = await requireTeamContext();
  const supabase = await createClient();
  const now = currentTime();
  const { start, end } = zonedDayRange(now, context.gym.timezone);
  const since30Days = new Date(now.getTime() - 30 * 86_400_000);
  const isCoachOnly = context.role === "coach";
  const showFinancials = canSeeFinancials(context.role);
  const showMembers = isStaffRole(context.role) && !isCoachOnly;
  const format = gymFormatters(context.gym.timezone);

  const [sessionsResult, activeResult, prospectsResult, failedResult] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), coaches(display_name, profile_id), bookings(status)",
      )
      .eq("gym_id", context.gym.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    showMembers
      ? supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", context.gym.id)
          .eq("status", "active")
      : null,
    showMembers
      ? supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", context.gym.id)
          .eq("status", "prospect")
      : null,
    showFinancials
      ? supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", context.gym.id)
          .eq("status", "failed")
          .gte("created_at", since30Days.toISOString())
      : null,
  ]);

  if (sessionsResult.error) {
    return <p className="text-destructive">{t("dashboard.loadError")}</p>;
  }

  const sessions = sessionsResult.data.map((session) => {
    const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), now);
    // Réservations lisibles : toutes pour l'accueil, celles de ses cours pour un coach (RLS).
    const toCheck =
      session.status === "scheduled" && phase !== "upcoming"
        ? session.bookings.filter((b) => b.status === "confirmed").length
        : 0;
    const mine = session.coaches?.profile_id === context.userId;
    return { ...session, phase, toCheck, mine };
  });

  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const counted = isCoachOnly ? scheduled.filter((s) => s.mine) : scheduled;
  const booked = counted.reduce((sum, s) => sum + s.booked_count, 0);
  const capacity = counted.reduce((sum, s) => sum + s.capacity, 0);
  const waitlist = counted.reduce((sum, s) => sum + s.waitlist_count, 0);
  const toCheck = counted.reduce((sum, s) => sum + s.toCheck, 0);
  const cancelled = sessions.length - scheduled.length;

  const kpis = (
    <section className="@container" aria-label={t("dashboard.indicators")}>
      <div className="grid gap-3 @min-[34rem]:grid-cols-2 @min-[60rem]:grid-cols-4">
        <KpiCard
          icon={CalendarCheckIcon}
          label={isCoachOnly ? t("dashboard.mySessions") : t("dashboard.sessions")}
          value={counted.length}
          hint={cancelled > 0 ? t("dashboard.cancelledCount", { count: cancelled }) : undefined}
        />
        <KpiCard
          icon={GaugeIcon}
          label={t("dashboard.fillRate")}
          value={capacity ? Math.round((booked / capacity) * 100) : "—"}
          suffix={capacity ? "%" : undefined}
          hint={t("dashboard.seats", { booked, capacity })}
        />
        <KpiCard
          icon={toCheck > 0 ? ClipboardCheckIcon : HourglassIcon}
          label={toCheck > 0 ? t("dashboard.toCheck") : t("dashboard.waitlistTotal")}
          value={toCheck > 0 ? toCheck : waitlist}
          hint={toCheck > 0 ? t("dashboard.toCheckHint") : t("dashboard.waitlistHint")}
        />
        {prospectsResult ? (
          <KpiCard
            icon={UserPlusIcon}
            label={t("dashboard.prospects")}
            value={prospectsResult.count ?? 0}
            hint={t("dashboard.activeMembers", { count: activeResult?.count ?? 0 })}
            href="/adherents?statut=prospect"
          />
        ) : null}
        {failedResult ? (
          <KpiCard
            icon={CreditCardIcon}
            label={t("dashboard.failedPayments")}
            value={failedResult.count ?? 0}
          />
        ) : null}
        {!prospectsResult && !failedResult ? (
          <KpiCard
            icon={UsersIcon}
            label={t("dashboard.waitlistTotal")}
            value={waitlist}
            hint={t("dashboard.waitlistHint")}
          />
        ) : null}
      </div>
    </section>
  );

  const list = (
    <section className="grid gap-3" aria-labelledby="seances-du-jour">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="seances-du-jour" className="text-lg font-medium">
          {t("dashboard.sessionsToday")}
        </h2>
        <Link href="/planning" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("dashboard.seeWeek")}
        </Link>
      </div>
      {sessions.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarXIcon />
            </EmptyMedia>
            <EmptyTitle>{t("dashboard.noSessions")}</EmptyTitle>
            <EmptyDescription>{t("dashboard.noSessionsHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-xl bg-card shadow-border">
          {sessions.map((session) => (
            <li key={session.id} className="border-t border-border/70 first:border-t-0">
              <Link
                href={`/planning/${session.id}`}
                className={cn(
                  "grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:bg-accent focus-visible:outline-none sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_auto]",
                  (session.phase === "past" || session.status === "cancelled") &&
                    "text-muted-foreground",
                )}
              >
                <span className="text-sm tabular-nums">
                  <span className="block font-medium text-foreground">
                    {format.time(session.starts_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format.time(session.ends_at)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <DisciplineChip
                    name={session.disciplines?.name ?? ""}
                    color={session.disciplines?.color}
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    {session.coaches?.display_name}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  {session.status === "cancelled" ? (
                    <StatusPill tone="danger">{t("dashboard.cancelled")}</StatusPill>
                  ) : session.toCheck > 0 ? (
                    <StatusPill tone="warning">
                      {t("dashboard.sessionToCheck", { count: session.toCheck })}
                    </StatusPill>
                  ) : (
                    <StatusPill
                      tone={session.phase === "live" ? "success" : "neutral"}
                      className={session.phase === "live" ? "[&>span]:animate-pulse" : undefined}
                    >
                      {t(`dashboard.phase.${session.phase}`)}
                    </StatusPill>
                  )}
                </span>
                {session.status === "scheduled" ? (
                  <span className="col-span-3 flex items-center gap-3 sm:col-span-1 sm:justify-end">
                    <OccupancyMeter
                      booked={session.booked_count}
                      capacity={session.capacity}
                      label={t("dashboard.fillRate")}
                      className="flex-1 sm:w-24 sm:flex-none"
                    />
                    <span className="min-w-12 text-right text-sm whitespace-nowrap text-foreground tabular-nums">
                      {t("dashboard.places", {
                        booked: session.booked_count,
                        capacity: session.capacity,
                      })}
                    </span>
                    {session.waitlist_count > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("dashboard.waitlist", { count: session.waitlist_count })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="grid gap-8">
      <PageHeader title={t("nav.today")} description={format.longDay(now)} />
      {/* L'accueil et les coachs travaillent dans la liste : elle passe avant les indicateurs. */}
      {canSeeFinancials(context.role) ? (
        <>
          {kpis}
          {list}
        </>
      ) : (
        <>
          {list}
          {kpis}
        </>
      )}
    </div>
  );
}
