import { BOOKING_STATUS_TONE, sessionPhase, zonedDateKey, zonedWeek } from "@salle/shared";
import { CheckCheckIcon, ClockIcon, DoorOpenIcon, UserIcon, UsersIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Flash } from "@/components/flash";
import { OccupancyMeter } from "@/components/occupancy-meter";
import { PageHeader } from "@/components/page-header";
import { AttendanceToggle } from "@/components/session/attendance-toggle";
import { MemberCombobox } from "@/components/session/member-combobox";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isFrontDeskRole, isManagerRole, requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters, initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import {
  bookMember,
  cancelBooking,
  cancelSession,
  markAllAttended,
  markAttendance,
  replaceCoach,
  resetAttendance,
  setAttendance,
} from "./actions";

const SEATED = ["confirmed", "attended", "no_show"] as const;
type Seated = (typeof SEATED)[number];

const loadSession = cache(async (id: string, gymId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, gym_id, starts_at, ends_at, capacity, status, cancellation_reason, booked_count, waitlist_count, disciplines(name, color), coaches(display_name, profile_id), rooms(name), bookings(id, status, waitlist_position, booked_at, members(id, first_name, last_name, email, phone))",
    )
    .eq("id", id)
    .eq("gym_id", gymId)
    .maybeSingle();
  return { session: data, error };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await requireTeamContext();
  const { session } = await loadSession(id, context.gym.id);
  if (!session) return { title: t("session.notFound") };
  const format = gymFormatters(context.gym.timezone);
  return {
    title: `${session.disciplines?.name ?? ""} ${format.time(session.starts_at)} · ${format.shortDay(session.starts_at)}`,
  };
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireTeamContext();
  const tz = context.gym.timezone;
  const format = gymFormatters(tz);
  const { session, error } = await loadSession(id, context.gym.id);
  if (error) throw new Error(error.message);
  if (!session) notFound();

  const now = currentTime();
  const frontDesk = isFrontDeskRole(context.role);
  const manager = isManagerRole(context.role);
  const ownCoach = session.coaches?.profile_id === context.userId;
  const canSeeBookings = frontDesk || ownCoach;
  const scheduled = session.status === "scheduled";
  const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), now);
  const full = session.booked_count >= session.capacity;
  const settings = await getGymSettings(context.gym.id);
  const startsAt = new Date(session.starts_at).getTime();
  // Stratégies : retardataires inscrits par l'accueil, fenêtre d'ouverture du pointage.
  const lateUntil = Math.min(
    startsAt + settings.late_booking_minutes * 60_000,
    new Date(session.ends_at).getTime(),
  );
  const canAddMember =
    frontDesk && scheduled && (phase === "upcoming" || now.getTime() < lateUntil);
  const attendanceOpensAt =
    settings.attendance_opens_minutes_before === null
      ? null
      : startsAt - settings.attendance_opens_minutes_before * 60_000;
  const attendanceOpen = attendanceOpensAt === null || now.getTime() >= attendanceOpensAt;

  // Remplaçants possibles (gérant) : disponibles et compétents d'abord.
  const canReplaceCoach = manager && scheduled && phase !== "past";
  const coachOptions = canReplaceCoach
    ? (
        (await (await createClient()).rpc("session_coach_options", { p_session_id: session.id }))
          .data ?? []
      )
        .filter((c) => !c.is_current)
        .sort(
          (a, b) =>
            Number(b.available && !b.has_conflict) - Number(a.available && !a.has_conflict) ||
            Number(b.teaches_discipline) - Number(a.teaches_discipline) ||
            a.display_name.localeCompare(b.display_name),
        )
    : [];

  const memberName = (m: { first_name: string; last_name: string } | null) =>
    m ? `${m.first_name} ${m.last_name}` : t("common.none");
  const seated = session.bookings
    .filter((b): b is typeof b & { status: Seated } =>
      (SEATED as readonly string[]).includes(b.status),
    )
    .sort((a, b) => (a.members?.last_name ?? "").localeCompare(b.members?.last_name ?? "", "fr"));
  const waitlist = session.bookings
    .filter((b) => b.status === "waitlisted")
    .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0));
  const cancelledCount = session.bookings.filter((b) => b.status === "cancelled").length;
  const toCheck = seated.filter((b) => b.status === "confirmed").length;
  const excludeIds = session.bookings
    .filter((b) => b.status !== "cancelled" && b.members)
    .map((b) => b.members?.id ?? "");

  const dayKey = zonedDateKey(new Date(session.starts_at), tz);
  const mondayKey = zonedWeek(new Date(session.starts_at), tz).days[0]?.key ?? dayKey;
  const backHref = `/planning?semaine=${mondayKey}&jour=${dayKey}`;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={backHref}>{t("nav.planning")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{format.longDay(session.starts_at)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={t("session.heading", {
          discipline: session.disciplines?.name ?? "",
          start: format.time(session.starts_at),
        })}
        description={
          <>
            <DisciplineChip
              name={session.disciplines?.name ?? ""}
              color={session.disciplines?.color}
            />
            {scheduled ? (
              <StatusPill tone={phase === "live" ? "success" : "neutral"}>
                {t(`dashboard.phase.${phase}`)}
              </StatusPill>
            ) : (
              <StatusPill tone="danger">{t("planning.cancelled")}</StatusPill>
            )}
            {scheduled && full ? (
              <StatusPill tone="warning">{t("planning.full")}</StatusPill>
            ) : null}
          </>
        }
      />

      <Flash ok={query.ok} error={query.erreur} />

      {!scheduled ? (
        <p
          role="status"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t("session.cancelledSummary", {
            reason: session.cancellation_reason || t("session.noReason"),
            count: cancelledCount,
          })}
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          {!canSeeBookings ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t("session.notYourSession")}
            </p>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <CardTitle>
                      {t("session.attendees")}{" "}
                      <span className="font-normal text-muted-foreground tabular-nums">
                        {seated.length}
                      </span>
                    </CardTitle>
                    {scheduled && phase !== "upcoming" && toCheck > 0 ? (
                      <CardDescription>{t("session.toCheck", { count: toCheck })}</CardDescription>
                    ) : null}
                  </div>
                  {scheduled && phase !== "upcoming" && toCheck > 0 ? (
                    <form action={markAllAttended}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <SubmitButton variant="outline" size="sm">
                        <CheckCheckIcon data-icon="inline-start" />
                        {t("session.markAllAttended")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {seated.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      {scheduled ? t("session.noAttendees") : t("session.noAttendeesCancelled")}
                    </p>
                  ) : (
                    <ul className="-mx-2">
                      {seated.map((booking) => {
                        const name = memberName(booking.members);
                        return (
                          <li
                            key={booking.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                          >
                            <Avatar className="size-9">
                              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                            </Avatar>
                            <span className="grid min-w-36 flex-1">
                              <span className="truncate font-medium">{name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {booking.members?.phone ?? booking.members?.email ?? ""}
                              </span>
                            </span>
                            {scheduled ? (
                              <>
                                {attendanceOpen ? (
                                  <AttendanceToggle
                                    bookingId={booking.id}
                                    sessionId={session.id}
                                    status={booking.status}
                                    memberName={name}
                                    mark={markAttendance}
                                    reset={
                                      settings.allow_attendance_reset ? resetAttendance : undefined
                                    }
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {t("session.attendanceOpensAt", {
                                      time: format.time(new Date(attendanceOpensAt ?? startsAt)),
                                    })}
                                  </span>
                                )}
                                <noscript>
                                  {(["attended", "no_show"] as const).map((status) => (
                                    <form key={status} action={setAttendance} className="inline">
                                      <input type="hidden" name="sessionId" value={session.id} />
                                      <input type="hidden" name="bookingId" value={booking.id} />
                                      <input type="hidden" name="status" value={status} />
                                      <button type="submit">
                                        {t(
                                          status === "attended"
                                            ? "session.markAttended"
                                            : "session.markNoShow",
                                        )}
                                      </button>
                                    </form>
                                  ))}
                                </noscript>
                                {frontDesk && booking.status === "confirmed" ? (
                                  <ConfirmDialog
                                    trigger={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t("session.cancelBookingOf", { name })}
                                        className="text-muted-foreground hover:text-destructive"
                                      >
                                        <XIcon />
                                      </Button>
                                    }
                                    title={t("session.cancelBookingTitle")}
                                    description={
                                      waitlist.length > 0
                                        ? t("session.cancelBookingPromotes", { name })
                                        : t("session.cancelBookingBody", { name })
                                    }
                                    confirmLabel={t("session.cancelBooking")}
                                    action={cancelBooking}
                                    fields={{ sessionId: session.id, bookingId: booking.id }}
                                  />
                                ) : null}
                              </>
                            ) : (
                              <StatusPill tone={BOOKING_STATUS_TONE[booking.status]}>
                                {t(`bookingStatus.${booking.status}`)}
                              </StatusPill>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {waitlist.length > 0 || (scheduled && phase === "upcoming") ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t("session.waitlist")}{" "}
                      <span className="font-normal text-muted-foreground tabular-nums">
                        {waitlist.length}
                      </span>
                    </CardTitle>
                    <CardDescription>{t("session.waitlistHint")}</CardDescription>
                  </CardHeader>
                  {waitlist.length > 0 ? (
                    <CardContent>
                      <ol className="-mx-2">
                        {waitlist.map((booking) => {
                          const name = memberName(booking.members);
                          return (
                            <li
                              key={booking.id}
                              className="flex items-center gap-3 rounded-lg px-2 py-2"
                            >
                              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                                {booking.waitlist_position}
                              </span>
                              <span className="flex-1 truncate">{name}</span>
                              {frontDesk && scheduled ? (
                                <ConfirmDialog
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={t("session.removeFromWaitlist", { name })}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <XIcon />
                                    </Button>
                                  }
                                  title={t("session.removeFromWaitlistTitle")}
                                  description={t("session.removeFromWaitlistBody", { name })}
                                  confirmLabel={t("session.removeFromWaitlistConfirm")}
                                  action={cancelBooking}
                                  fields={{ sessionId: session.id, bookingId: booking.id }}
                                />
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    </CardContent>
                  ) : null}
                </Card>
              ) : null}
            </>
          )}
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-20">
          <Card>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{t("session.places")}</span>
                  <span className="text-2xl font-medium tabular-nums">
                    {session.booked_count}
                    <span className="text-base text-muted-foreground">/{session.capacity}</span>
                  </span>
                </div>
                <OccupancyMeter
                  booked={session.booked_count}
                  capacity={session.capacity}
                  label={t("planning.occupancy")}
                  className="w-full"
                />
                {session.waitlist_count > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("planning.waitlistLong", { count: session.waitlist_count })}
                  </span>
                ) : null}
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">{t("session.timeLabel")}</dt>
                  <dd className="tabular-nums">
                    {t("session.time", {
                      start: format.time(session.starts_at),
                      end: format.time(session.ends_at),
                    })}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">{t("session.coachLabel")}</dt>
                  <dd>{session.coaches?.display_name ?? t("session.noCoach")}</dd>
                </div>
                {session.rooms ? (
                  <div className="flex items-center gap-2">
                    <DoorOpenIcon className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("session.roomLabel")}</dt>
                    <dd>{session.rooms.name}</dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">{t("session.capacityLabel")}</dt>
                  <dd>{t("session.capacity", { count: session.capacity })}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canAddMember ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {phase === "upcoming" ? t("session.addMember") : t("session.addLateMember")}
                </CardTitle>
                <CardDescription>
                  {phase === "upcoming"
                    ? t("session.addMemberHint")
                    : t("session.addLateMemberHint", { time: format.time(new Date(lateUntil)) })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MemberCombobox
                  sessionId={session.id}
                  excludeIds={excludeIds}
                  action={bookMember}
                  full={full}
                />
              </CardContent>
            </Card>
          ) : null}

          {canReplaceCoach && coachOptions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("session.replaceCoach")}</CardTitle>
                <CardDescription>{t("session.replaceCoachHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={replaceCoach} className="grid gap-3">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Label htmlFor="replace-coach" className="sr-only">
                    {t("session.newCoach")}
                  </Label>
                  <NativeSelect id="replace-coach" name="coachId" required className="w-full">
                    {coachOptions.map((c) => (
                      <NativeSelectOption key={c.coach_id} value={c.coach_id}>
                        {c.display_name} ·{" "}
                        {c.has_conflict
                          ? t("session.coachBusy")
                          : c.available
                            ? t("session.coachAvailable")
                            : t("session.coachUnavailable")}
                        {c.teaches_discipline ? "" : ` · ${t("session.coachOtherDiscipline")}`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Input name="note" maxLength={200} placeholder={t("session.replaceNote")} />
                  <SubmitButton variant="outline">{t("session.replaceCoachConfirm")}</SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {manager && scheduled ? (
            <Card className="bg-destructive/[0.03]">
              <CardHeader>
                <CardTitle>{t("session.cancelSession")}</CardTitle>
                <CardDescription>{t("session.cancelSessionHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" className="w-full">
                      {t("session.cancelSession")}
                    </Button>
                  }
                  title={t("session.cancelSessionTitle")}
                  description={t("session.cancelSessionSummary", {
                    booked: seated.length,
                    waitlist: waitlist.length,
                  })}
                  confirmLabel={t("session.cancelSessionConfirm")}
                  action={cancelSession}
                  fields={{ sessionId: session.id }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="reason">{t("session.cancelReason")}</Label>
                    <Input
                      id="reason"
                      name="reason"
                      maxLength={200}
                      placeholder={t("session.cancelReasonPlaceholder")}
                    />
                  </div>
                </ConfirmDialog>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
