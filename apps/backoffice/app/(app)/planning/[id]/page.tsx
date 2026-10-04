import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isFrontDeskRole, isManagerRole, requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { bookMember, cancelBooking, cancelSession, setAttendance } from "./actions";

const SEATED = ["confirmed", "attended", "no_show"] as const;

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; ok?: string; erreur?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireTeamContext();
  const format = gymFormatters(context.gym.timezone);
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("class_sessions")
    .select(
      "id, gym_id, starts_at, ends_at, capacity, status, cancellation_reason, booked_count, waitlist_count, disciplines(name, color), coaches(display_name, profile_id), rooms(name), bookings(id, status, waitlist_position, booked_at, members(id, first_name, last_name, email))",
    )
    .eq("id", id)
    .eq("gym_id", context.gym.id)
    .maybeSingle();
  if (!session) notFound();

  const frontDesk = isFrontDeskRole(context.role);
  const ownCoach = session.coaches?.profile_id === context.userId;
  const canSeeBookings = frontDesk || ownCoach;
  const scheduled = session.status === "scheduled";
  const upcoming = Date.parse(session.starts_at) > currentTime().getTime();

  const seated = session.bookings
    .filter((b) => (SEATED as readonly string[]).includes(b.status))
    .sort((a, b) => (a.members?.last_name ?? "").localeCompare(b.members?.last_name ?? ""));
  const waitlist = session.bookings
    .filter((b) => b.status === "waitlisted")
    .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0));

  // Recherche d'adhérents actifs à inscrire (accueil et plus).
  const search = query.q?.trim() ?? "";
  const alreadyIn = new Set(
    session.bookings.filter((b) => b.status !== "cancelled").map((b) => b.members?.id),
  );
  const { data: candidates } =
    frontDesk && search.length >= 2
      ? await supabase
          .from("members")
          .select("id, first_name, last_name, email")
          .eq("gym_id", context.gym.id)
          .eq("status", "active")
          .or(
            `first_name.ilike.%${search.replace(/[%,()]/g, "")}%,last_name.ilike.%${search.replace(/[%,()]/g, "")}%,email.ilike.%${search.replace(/[%,()]/g, "")}%`,
          )
          .order("last_name")
          .limit(8)
      : { data: [] };

  const memberName = (m: { first_name: string; last_name: string } | null) =>
    m ? `${m.first_name} ${m.last_name}` : t("common.none");

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Link href="/planning" className="text-sm text-muted-foreground hover:underline">
          ← {t("nav.planning")}
        </Link>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span
            aria-hidden
            className="size-3 rounded-full"
            style={{ backgroundColor: session.disciplines?.color ?? "var(--color-neutral-500)" }}
          />
          {t("session.title", {
            discipline: session.disciplines?.name ?? "",
            date: format.longDay(session.starts_at),
          })}
        </h1>
        <p className="text-muted-foreground">
          {t("session.time", {
            start: format.time(session.starts_at),
            end: format.time(session.ends_at),
          })}
          {" · "}
          {session.coaches
            ? t("session.coach", { name: session.coaches.display_name })
            : t("session.noCoach")}
          {session.rooms ? ` · ${t("session.room", { name: session.rooms.name })}` : ""}
        </p>
        <p className="font-medium tabular-nums">
          {t("session.occupancy", {
            booked: session.booked_count,
            capacity: session.capacity,
            waitlist: session.waitlist_count,
          })}
        </p>
        {!scheduled ? (
          <Badge variant="destructive" className="w-fit">
            {t("session.cancelledBecause", {
              reason: session.cancellation_reason ?? t("common.none"),
            })}
          </Badge>
        ) : null}
      </div>

      <Flash ok={query.ok} error={query.erreur} />

      {!canSeeBookings ? (
        <p className="text-muted-foreground">{t("session.notYourSession")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("session.attendees")}</CardTitle>
            </CardHeader>
            <CardContent>
              {seated.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("session.noAttendees")}</p>
              ) : (
                <ul className="divide-y">
                  {seated.map((booking) => (
                    <li key={booking.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="min-w-40 flex-1">
                        <span className="block font-medium">{memberName(booking.members)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t("session.bookedAt", { date: format.dateTime(booking.booked_at) })}
                        </span>
                      </span>
                      <Badge variant={booking.status === "attended" ? "default" : "outline"}>
                        {t(`bookingStatus.${booking.status}`)}
                      </Badge>
                      {scheduled ? (
                        <>
                          {(["attended", "no_show"] as const).map((status) => (
                            <form key={status} action={setAttendance}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="bookingId" value={booking.id} />
                              <input type="hidden" name="status" value={status} />
                              <Button
                                size="sm"
                                variant={booking.status === status ? "secondary" : "ghost"}
                                disabled={booking.status === status}
                              >
                                {t(
                                  status === "attended"
                                    ? "session.markAttended"
                                    : "session.markNoShow",
                                )}
                              </Button>
                            </form>
                          ))}
                          {frontDesk && booking.status === "confirmed" ? (
                            <form action={cancelBooking}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="bookingId" value={booking.id} />
                              <Button size="sm" variant="ghost" className="text-destructive">
                                {t("session.cancelBooking")}
                              </Button>
                            </form>
                          ) : null}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("session.waitlist")}</CardTitle>
            </CardHeader>
            <CardContent>
              {waitlist.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("session.noWaitlist")}</p>
              ) : (
                <ol className="divide-y">
                  {waitlist.map((booking) => (
                    <li key={booking.id} className="flex items-center gap-3 py-2">
                      <span className="w-6 text-right font-semibold tabular-nums">
                        {booking.waitlist_position}
                      </span>
                      <span className="flex-1">{memberName(booking.members)}</span>
                      {frontDesk && scheduled ? (
                        <form action={cancelBooking}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <Button size="sm" variant="ghost" className="text-destructive">
                            {t("session.cancelBooking")}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {frontDesk && scheduled && upcoming ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("session.addMember")}</CardTitle>
                <CardDescription>{t("session.addMemberHint")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <form className="flex gap-2" role="search">
                  <Input
                    name="q"
                    defaultValue={search}
                    placeholder={t("session.searchPlaceholder")}
                    aria-label={t("session.searchPlaceholder")}
                  />
                  <Button type="submit" variant="outline">
                    {t("common.search")}
                  </Button>
                </form>
                {search.length >= 2 && (candidates ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("session.noResult")}</p>
                ) : null}
                <ul className="divide-y">
                  {(candidates ?? [])
                    .filter((member) => !alreadyIn.has(member.id))
                    .map((member) => (
                      <li key={member.id} className="flex items-center gap-3 py-2">
                        <span className="flex-1">
                          <span className="block">{memberName(member)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        </span>
                        <form action={bookMember}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="memberId" value={member.id} />
                          <Button size="sm">{t("session.book")}</Button>
                        </form>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {isManagerRole(context.role) && scheduled ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("session.cancelSession")}</CardTitle>
                <CardDescription>{t("session.cancelSessionHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={cancelSession} className="grid gap-3">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="reason">{t("session.cancelReason")}</Label>
                    <Input id="reason" name="reason" maxLength={200} />
                  </div>
                  <Button variant="destructive" className="w-fit">
                    {t("session.cancelSession")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
