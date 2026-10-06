import { shiftDateKey, zonedDateKey } from "@salle/shared";
import {
  BanknoteIcon,
  CalendarCheckIcon,
  ClockIcon,
  CreditCardIcon,
  PercentIcon,
  RepeatIcon,
  UserPlusIcon,
  UserXIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { KpiCard } from "@/components/kpi-card";
import { Heatmap } from "@/components/kpis/heatmap";
import { KpiPeriod } from "@/components/kpis/kpi-period";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { euros, gymFormatters, hoursLabel } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("kpis.title") };

const PRESETS = [7, 30, 90] as const;
const ratio = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Résultat de la fonction SQL gym_kpis.
const kpisSchema = z.object({
  new_members: z.number(),
  new_members_active: z.number(),
  sessions: z.number(),
  seats: z.number(),
  capacity: z.number(),
  attended: z.number(),
  no_show: z.number(),
  by_discipline: z.array(
    z.object({
      name: z.string(),
      color: z.string(),
      sessions: z.number(),
      seats: z.number(),
      capacity: z.number(),
    }),
  ),
  heatmap: z.array(
    z.object({ weekday: z.number(), hour: z.number(), seats: z.number(), capacity: z.number() }),
  ),
  at_risk: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      recent: z.number(),
      previous: z.number(),
      last_at: z.string().nullable(),
    }),
  ),
  coach_minutes: z.number(),
  coach_amount_cents: z.number(),
  revenue_cents: z.number(),
  failed_payments: z.number(),
  mrr_cents: z.number(),
  active_subscriptions: z.number(),
});

/**
 * Indicateurs de la période (champ de période à raccourcis) : adhésions, remplissage, présences,
 * risques, heures coachs ; variation par rapport à la période précédente de même durée.
 */
export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ jours?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const today = zonedDateKey(currentTime(), context.gym.timezone);
  const custom =
    z.iso.date().safeParse(params.du).success && z.iso.date().safeParse(params.au).success;
  const preset = PRESETS.find((p) => String(p) === params.jours) ?? 30;
  const from = custom ? (params.du ?? today) : shiftDateKey(today, -(preset - 1));
  const to = custom ? (params.au ?? today) : today;

  // Période précédente de même durée, juste avant : variation de chaque indicateur.
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const previousTo = shiftDateKey(from, -1);
  const previousFrom = shiftDateKey(previousTo, -(length - 1));

  const supabase = await createClient();
  const [{ data, error }, { data: previousData }] = await Promise.all([
    supabase.rpc("gym_kpis", { p_gym_id: context.gym.id, p_from: from, p_to: to }),
    supabase.rpc("gym_kpis", { p_gym_id: context.gym.id, p_from: previousFrom, p_to: previousTo }),
  ]);
  const parsed = kpisSchema.safeParse(data);
  const previous = kpisSchema.safeParse(previousData).data ?? null;
  if (error || !parsed.success) {
    return (
      <div className="grid gap-6">
        <PageHeader title={t("kpis.title")} />
        <p className="text-destructive">{t("kpis.invalid")}</p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/indicateurs">{t("kpis.reset")}</Link>
        </Button>
      </div>
    );
  }
  const k = parsed.data;
  const checked = k.attended + k.no_show;
  const previousChecked = previous ? previous.attended + previous.no_show : 0;

  return (
    <UrlStateProvider>
      <div className="grid gap-6">
        <PageHeader
          title={t("kpis.title")}
          description={t("kpis.period", { from: format.dateKey(from), to: format.dateKey(to) })}
          actions={<KpiPeriod from={from} to={to} todayKey={today} />}
        />

        <PendingRegion className="grid gap-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
            <KpiCard
              label={t("kpis.newMembers")}
              value={k.new_members}
              hint={t("kpis.conversion", { rate: ratio(k.new_members_active, k.new_members) })}
              icon={UserPlusIcon}
              trend={{ current: k.new_members, previous: previous?.new_members ?? null }}
            />
            <KpiCard
              label={t("kpis.fillRate")}
              value={ratio(k.seats, k.capacity)}
              suffix="%"
              hint={t("kpis.seats", { seats: k.seats, capacity: k.capacity, sessions: k.sessions })}
              icon={PercentIcon}
              trend={{
                current: ratio(k.seats, k.capacity),
                previous: previous?.capacity ? ratio(previous.seats, previous.capacity) : null,
              }}
            />
            <KpiCard
              label={t("kpis.attendance")}
              value={ratio(k.attended, checked)}
              suffix="%"
              hint={t("kpis.attendanceHint", { attended: k.attended, noShow: k.no_show })}
              icon={CalendarCheckIcon}
              trend={{
                current: ratio(k.attended, checked),
                previous:
                  previous && previousChecked ? ratio(previous.attended, previousChecked) : null,
              }}
            />
            <KpiCard
              label={t("kpis.atRisk")}
              value={k.at_risk.length}
              hint={t("kpis.atRiskHint")}
              icon={UserXIcon}
            />
            <KpiCard
              label={t("kpis.coachHours")}
              value={hoursLabel(k.coach_minutes)}
              hint={euros(k.coach_amount_cents)}
              icon={ClockIcon}
              trend={{ current: k.coach_minutes, previous: previous?.coach_minutes ?? null }}
              href={`/coachs/heures?mois=${to.slice(0, 7)}`}
            />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
            <KpiCard
              label={t("kpis.revenue")}
              value={euros(k.revenue_cents)}
              hint={t("kpis.revenueHint")}
              icon={BanknoteIcon}
              trend={{ current: k.revenue_cents, previous: previous?.revenue_cents ?? null }}
              href={`/paiements?du=${from}&au=${to}`}
            />
            <KpiCard
              label={t("kpis.mrr")}
              value={euros(k.mrr_cents)}
              hint={t("kpis.activeSubscriptions", { count: k.active_subscriptions })}
              icon={RepeatIcon}
            />
            <KpiCard
              label={t("kpis.failedPayments")}
              value={k.failed_payments}
              hint={t("kpis.failedPaymentsHint")}
              icon={CreditCardIcon}
              trend={{
                current: k.failed_payments,
                previous: previous?.failed_payments ?? null,
                higherIsBetter: false,
              }}
              href={`/paiements?du=${from}&au=${to}&statut=failed`}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("kpis.byDiscipline")}</CardTitle>
                <CardDescription>{t("kpis.byDisciplineHint")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {k.by_discipline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("kpis.noData")}</p>
                ) : (
                  k.by_discipline.map((d) => {
                    const rate = ratio(d.seats, d.capacity);
                    return (
                      <div key={d.name} className="grid gap-1 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {rate} % · {t("kpis.sessionsCount", { count: d.sessions })}
                          </span>
                        </div>
                        <div
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="meter"
                          aria-label={d.name}
                          aria-valuenow={rate}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: d.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("kpis.atRiskTitle")}</CardTitle>
                <CardDescription>{t("kpis.atRiskDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                {k.at_risk.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("kpis.noRisk")}</p>
                ) : (
                  <ul className="-mx-2">
                    {k.at_risk.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/adherents/${m.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {t("kpis.trend", { previous: m.previous, recent: m.recent })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("kpis.heatmap")}</CardTitle>
              <CardDescription>{t("kpis.heatmapHint")}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {k.heatmap.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("kpis.noData")}</p>
              ) : (
                <Heatmap cells={k.heatmap} />
              )}
            </CardContent>
          </Card>
        </PendingRegion>
      </div>
    </UrlStateProvider>
  );
}
