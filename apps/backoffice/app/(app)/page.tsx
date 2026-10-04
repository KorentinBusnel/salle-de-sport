import { canSeeFinancials, isStaffRole, zonedDayRange } from "@salle/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

// Réservations qui occupent une place (les annulées et la liste d'attente n'en occupent pas).
const SEATED = new Set(["confirmed", "attended", "no_show"]);

export default async function DashboardPage() {
  const context = await requireTeamContext();
  const supabase = await createClient();
  const now = new Date();
  const { start, end } = zonedDayRange(now, context.gym.timezone);
  const since30Days = new Date(now.getTime() - 30 * 86_400_000);
  const isCoachOnly = context.role === "coach";
  const showFinancials = canSeeFinancials(context.role);
  const showMembers = isStaffRole(context.role) && !isCoachOnly;

  const [sessionsResult, membersResult, failedResult] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, status, disciplines(name, color), coaches(display_name, profile_id), bookings(status)",
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
    // Un coach ne voit que les réservations de ses propres séances (RLS).
    const visible = !isCoachOnly || session.coaches?.profile_id === context.userId;
    const booked = session.bookings.filter((b) => SEATED.has(b.status)).length;
    const waitlisted = session.bookings.filter((b) => b.status === "waitlisted").length;
    return { ...session, visible, booked, waitlisted };
  });

  const counted = sessions.filter((s) => s.visible && s.status === "scheduled");
  const bookedToday = counted.reduce((sum, s) => sum + s.booked, 0);
  const capacityToday = counted.reduce((sum, s) => sum + s.capacity, 0);

  const timeFormat = new Intl.DateTimeFormat("fr-FR", {
    timeZone: context.gym.timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayFormat = new Intl.DateTimeFormat("fr-FR", {
    timeZone: context.gym.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const kpis = [
    { label: t("dashboard.bookingsToday"), value: String(bookedToday) },
    {
      label: t("dashboard.fillRate"),
      value: capacityToday ? `${Math.round((bookedToday / capacityToday) * 100)} %` : "—",
    },
    ...(membersResult
      ? [{ label: t("dashboard.activeMembers"), value: String(membersResult.count ?? 0) }]
      : []),
    ...(failedResult
      ? [{ label: t("dashboard.failedPayments"), value: String(failedResult.count ?? 0) }]
      : []),
  ];

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-semibold first-letter:uppercase">{dayFormat.format(now)}</h1>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{kpi.value}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("dashboard.sessionsToday")}</h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">{t("dashboard.noSessions")}</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {sessions.map((session) => {
              const ratio = session.capacity ? Math.min(1, session.booked / session.capacity) : 0;
              const color = session.disciplines?.color ?? "var(--color-neutral-500)";
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                >
                  <span className="w-28 tabular-nums text-sm">
                    {timeFormat.format(new Date(session.starts_at))} –{" "}
                    {timeFormat.format(new Date(session.ends_at))}
                  </span>
                  <span className="flex min-w-40 items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {session.disciplines?.name}
                  </span>
                  <span className="min-w-28 text-sm text-muted-foreground">
                    {session.coaches?.display_name}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {session.status === "cancelled" ? (
                      <Badge variant="destructive">{t("dashboard.cancelled")}</Badge>
                    ) : session.visible ? (
                      <>
                        {session.waitlisted > 0 ? (
                          <Badge variant="outline">
                            {t("dashboard.waitlist", { count: session.waitlisted })}
                          </Badge>
                        ) : null}
                        <span
                          className="h-2 w-24 overflow-hidden rounded-full bg-muted"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={session.capacity}
                          aria-valuenow={session.booked}
                          aria-label={t("dashboard.fillRate")}
                        >
                          <span
                            className="block h-full bg-primary"
                            style={{ width: `${ratio * 100}%` }}
                          />
                        </span>
                        <span className="w-14 text-right text-sm tabular-nums">
                          {t("dashboard.places", {
                            booked: session.booked,
                            capacity: session.capacity,
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("dashboard.notYourClass")}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
