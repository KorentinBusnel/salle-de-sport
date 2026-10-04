import { zonedDateKey } from "@salle/shared";
import { CalendarCheckIcon, ClockIcon, PercentIcon, UserPlusIcon, UserXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
});

function shift(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Indicateurs de la période : adhésions, remplissage, présences, risques, heures coachs. */
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
  const from = custom ? (params.du ?? today) : shift(today, -(preset - 1));
  const to = custom ? (params.au ?? today) : today;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gym_kpis", {
    p_gym_id: context.gym.id,
    p_from: from,
    p_to: to,
  });
  const parsed = kpisSchema.safeParse(data);
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
  const heat = new Map(k.heatmap.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const hours = [...new Set(k.heatmap.map((c) => c.hour))].sort((a, b) => a - b);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("kpis.title")}
        description={t("kpis.period", { from: format.dateKey(from), to: format.dateKey(to) })}
        actions={
          <>
            <ButtonGroup aria-label={t("kpis.presets")}>
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  asChild
                  size="sm"
                  variant={!custom && p === preset ? "secondary" : "outline"}
                >
                  <Link href={`/indicateurs?jours=${p}`}>{t("kpis.days", { count: p })}</Link>
                </Button>
              ))}
            </ButtonGroup>
            <form className="flex items-center gap-2" aria-label={t("kpis.custom")}>
              <Input
                type="date"
                name="du"
                defaultValue={from}
                aria-label={t("kpis.from")}
                className="h-8 w-40"
              />
              <Input
                type="date"
                name="au"
                defaultValue={to}
                aria-label={t("kpis.to")}
                className="h-8 w-40"
              />
              <Button type="submit" size="sm" variant="outline">
                {t("kpis.apply")}
              </Button>
            </form>
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
        <KpiCard
          label={t("kpis.newMembers")}
          value={k.new_members}
          hint={t("kpis.conversion", { rate: ratio(k.new_members_active, k.new_members) })}
          icon={UserPlusIcon}
        />
        <KpiCard
          label={t("kpis.fillRate")}
          value={ratio(k.seats, k.capacity)}
          suffix="%"
          hint={t("kpis.seats", { seats: k.seats, capacity: k.capacity, sessions: k.sessions })}
          icon={PercentIcon}
        />
        <KpiCard
          label={t("kpis.attendance")}
          value={ratio(k.attended, checked)}
          suffix="%"
          hint={t("kpis.attendanceHint", { attended: k.attended, noShow: k.no_show })}
          icon={CalendarCheckIcon}
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
          href={`/coachs/heures?mois=${to.slice(0, 7)}`}
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
          {hours.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("kpis.noData")}</p>
          ) : (
            <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="w-12" />
                  {(["1", "2", "3", "4", "5", "6", "7"] as const).map((d) => (
                    <th key={d} className="font-medium text-muted-foreground">
                      {t(`weekdays.${d}`).slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h}>
                    <th className="text-right font-normal text-muted-foreground tabular-nums">
                      {h} h
                    </th>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const cell = heat.get(`${d}-${h}`);
                      const rate = cell ? ratio(cell.seats, cell.capacity) : null;
                      return (
                        <td
                          key={d}
                          className="h-8 rounded-md text-center tabular-nums"
                          style={
                            rate === null
                              ? { backgroundColor: "var(--color-muted)" }
                              : {
                                  backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.max(8, rate)}%, var(--color-card))`,
                                  color:
                                    rate > 85
                                      ? "var(--color-primary-foreground)"
                                      : "var(--color-foreground)",
                                }
                          }
                          title={rate === null ? undefined : `${rate} %`}
                        >
                          {rate === null ? "" : `${rate} %`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
