import {
  BOOKING_STATUS_TONE,
  CAPACITY,
  DURATION,
  sessionPhase,
  zonedDateKey,
  zonedWeek,
} from "@salle/shared";
import { ClockIcon, DoorOpenIcon, TagIcon, UserIcon, UsersIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Flash } from "@/components/flash";
import { type CellOption, EditableCell } from "@/components/inline/editable-cell";
import { PageHeader } from "@/components/page-header";
import { AttendanceToggle } from "@/components/session/attendance-toggle";
import { MemberCombobox } from "@/components/session/member-combobox";
import { MoveSessionForm } from "@/components/session/move-session";
import {
  AttendeeListTail,
  MarkAllButton,
  SessionLiveProvider,
} from "@/components/session/session-live";
import { SegmentMeter } from "@/components/segment-meter";
import { TextareaWithCount } from "@/components/forms/textarea-with-count";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageCrumb } from "@/components/page-crumb";
import { isFrontDeskRole, isManagerRole, requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters, initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import {
  cancelBooking,
  cancelSession,
  markAttendance,
  resetAttendance,
  setAttendance,
  updateSessionField,
} from "./actions";

const SEATED = ["confirmed", "attended", "no_show"] as const;
type Seated = (typeof SEATED)[number];

const loadSession = cache(async (id: string, gymId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, gym_id, starts_at, ends_at, capacity, status, cancellation_reason, booked_count, waitlist_count, disciplines(name, color), template_id, discipline_id, room_id, session_coaches(position, coaches(id, display_name, profile_id)), rooms(name), bookings(id, status, waitlist_position, booked_at, members(id, first_name, last_name, email, phone))",
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
  const sessionCoaches = [...session.session_coaches]
    .sort((a, b) => a.position - b.position)
    .flatMap((sc) => (sc.coaches ? [sc.coaches] : []));
  const ownCoach = sessionCoaches.some((c) => c.profile_id === context.userId);
  const canSeeBookings = frontDesk || ownCoach;
  const scheduled = session.status === "scheduled";
  const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), now);
  const full = session.booked_count >= session.capacity;
  // Édition en place (gérant, séance pas encore terminée) : coachs, durée, places, salle.
  const canEdit = manager && scheduled && phase !== "past";
  const seatedIds = session.bookings
    .filter((b) => (SEATED as readonly string[]).includes(b.status))
    .flatMap((b) => (b.members ? [b.members.id] : []));
  const supabase = await createClient();
  // Réglages, choix d'édition et notes « à savoir » : chargés ensemble.
  const [settings, [coachOptions, roomOptions, disciplineOptions], careRows] = await Promise.all([
    getGymSettings(context.gym.id),
    canEdit
      ? Promise.all([
          supabase.rpc("session_coach_options", { p_session_id: session.id }).then(({ data }) =>
            (data ?? []).map((c) => ({
              value: c.coach_id,
              label: c.display_name,
              hint: c.is_current
                ? undefined
                : c.has_conflict
                  ? t("session.coachBusy")
                  : c.available
                    ? t("session.coachAvailable")
                    : c.teaches_discipline
                      ? t("session.coachUnavailable")
                      : t("session.coachOtherDiscipline"),
            })),
          ),
          supabase
            .from("rooms")
            .select("id, name, capacity")
            .eq("gym_id", context.gym.id)
            .order("name")
            .then(({ data }) =>
              (data ?? []).map((r) => ({
                value: r.id,
                label: r.name,
                hint: t("catalog.placesCount", { count: r.capacity }),
              })),
            ),
          supabase
            .from("disciplines")
            .select("id, name")
            .eq("gym_id", context.gym.id)
            .eq("is_active", true)
            .order("position")
            .order("name")
            .then(({ data }) => (data ?? []).map((d) => ({ value: d.id, label: d.name }))),
        ])
      : Promise.resolve<[CellOption[], CellOption[], CellOption[]]>([[], [], []]),
    // Notes « à savoir » des inscrits : la RLS ne les ouvre qu'à l'accueil, au gérant et aux coachs.
    seatedIds.length
      ? supabase
          .from("member_care_notes")
          .select("member_id, note")
          .in("member_id", seatedIds)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
  ]);
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
  const durationMinutes = Math.round(
    (Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60_000,
  );
  const recurring = session.template_id !== null;

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
  const careNotes = new Map(careRows.map((row) => [row.member_id, row.note]));
  const toCheck = seated.filter((b) => b.status === "confirmed").length;
  const excludeIds = session.bookings
    .filter((b) => b.status !== "cancelled" && b.members)
    .map((b) => b.members?.id ?? "");

  const dayKey = zonedDateKey(new Date(session.starts_at), tz);
  const mondayKey = zonedWeek(new Date(session.starts_at), tz).days[0]?.key ?? dayKey;
  const backHref = `/planning?semaine=${mondayKey}&jour=${dayKey}`;

  return (
    <div className="grid gap-6">
      <PageCrumb label={format.longDay(session.starts_at)} parentHref={backHref} />
      <PageHeader
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

      <SessionLiveProvider sessionId={session.id} allowReset={settings.allow_attendance_reset}>
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
                        <CardDescription>
                          {t("session.toCheck", { count: toCheck })}
                        </CardDescription>
                      ) : null}
                    </div>
                    {scheduled && phase !== "upcoming" && toCheck > 0 && attendanceOpen ? (
                      <MarkAllButton />
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {
                      <ul className="-mx-2">
                        {seated.map((booking) => {
                          const name = memberName(booking.members);
                          return (
                            <li
                              key={booking.id}
                              className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                            >
                              <Avatar className="size-9">
                                <AvatarFallback className="text-xs">
                                  {initials(name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="grid min-w-36 flex-1">
                                <span className="truncate font-medium">{name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {booking.members?.phone ?? booking.members?.email ?? ""}
                                </span>
                                {booking.members && careNotes.has(booking.members.id) ? (
                                  <span className="text-xs text-warning">
                                    <span className="font-medium">
                                      {t("memberProfile.careNote")} :{" "}
                                    </span>
                                    {careNotes.get(booking.members.id)}
                                  </span>
                                ) : null}
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
                                        settings.allow_attendance_reset
                                          ? resetAttendance
                                          : undefined
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
                        <AttendeeListTail
                          hasRows={seated.length > 0}
                          empty={
                            scheduled ? t("session.noAttendees") : t("session.noAttendeesCancelled")
                          }
                        />
                      </ul>
                    }
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
                  <SegmentMeter
                    label={t("planning.occupancy")}
                    total={session.capacity}
                    segments={
                      canSeeBookings && scheduled
                        ? [
                            {
                              label: t("bookingStatus.attended"),
                              value: seated.filter((b) => b.status === "attended").length,
                              tone: "success",
                            },
                            {
                              label: t("bookingStatus.confirmed"),
                              value: seated.filter((b) => b.status === "confirmed").length,
                              tone: "brand",
                            },
                            {
                              label: t("bookingStatus.no_show"),
                              value: seated.filter((b) => b.status === "no_show").length,
                              tone: "danger",
                            },
                            {
                              label: t("planning.sheet.free"),
                              value: Math.max(0, session.capacity - seated.length),
                              tone: "neutral",
                            },
                          ]
                        : [
                            {
                              label: t("planning.sheet.booked"),
                              value: session.booked_count,
                              tone: "brand",
                            },
                            {
                              label: t("planning.sheet.free"),
                              value: Math.max(0, session.capacity - session.booked_count),
                              tone: "neutral",
                            },
                          ]
                    }
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
                    <dd className="flex min-w-0 flex-1 items-center gap-1 tabular-nums">
                      <span className="shrink-0">
                        {t("session.time", {
                          start: format.time(session.starts_at),
                          end: format.time(session.ends_at),
                        })}
                      </span>
                      {canEdit ? (
                        <EditableCell
                          kind="number"
                          id={session.id}
                          field="duration_minutes"
                          label={t("session.durationLabel")}
                          value={durationMinutes}
                          unit={t("catalog.minutes")}
                          min={DURATION.min}
                          max={DURATION.max}
                          step={DURATION.step}
                          askScope={recurring}
                          action={updateSessionField}
                        />
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("session.coachLabel")}</dt>
                    <dd className="min-w-0 flex-1">
                      {canEdit ? (
                        <EditableCell
                          kind="multi"
                          id={session.id}
                          field="coach_ids"
                          label={t("session.coachLabel")}
                          value={sessionCoaches.map((c) => c.id)}
                          options={coachOptions}
                          askScope={recurring}
                          action={updateSessionField}
                        />
                      ) : sessionCoaches.length ? (
                        sessionCoaches.map((c) => c.display_name).join(", ")
                      ) : (
                        t("session.noCoach")
                      )}
                    </dd>
                  </div>
                  {session.rooms || canEdit ? (
                    <div className="flex items-center gap-2">
                      <DoorOpenIcon className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">{t("session.roomLabel")}</dt>
                      <dd className="min-w-0 flex-1">
                        {canEdit ? (
                          <EditableCell
                            kind="select"
                            id={session.id}
                            field="room_id"
                            label={t("session.roomLabel")}
                            value={session.room_id}
                            options={roomOptions}
                            clearable
                            askScope={recurring}
                            action={updateSessionField}
                          />
                        ) : (
                          session.rooms?.name
                        )}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("session.capacityLabel")}</dt>
                    <dd className="min-w-0 flex-1">
                      {canEdit ? (
                        <EditableCell
                          kind="number"
                          id={session.id}
                          field="capacity"
                          label={t("session.capacityLabel")}
                          value={session.capacity}
                          unit={t("catalog.places")}
                          min={CAPACITY.min}
                          max={CAPACITY.max}
                          askScope={recurring}
                          action={updateSessionField}
                        />
                      ) : (
                        t("session.capacity", { count: session.capacity })
                      )}
                    </dd>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <TagIcon className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">{t("session.disciplineLabel")}</dt>
                      <dd className="min-w-0 flex-1">
                        <EditableCell
                          kind="select"
                          id={session.id}
                          field="discipline_id"
                          label={t("session.disciplineLabel")}
                          value={session.discipline_id}
                          options={disciplineOptions}
                          askScope={recurring}
                          action={updateSessionField}
                        />
                      </dd>
                    </div>
                  ) : null}
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
                  <MemberCombobox excludeIds={excludeIds} full={full} />
                </CardContent>
              </Card>
            ) : null}

            {manager && scheduled && phase === "upcoming" ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t("session.moveSession")}</CardTitle>
                  <CardDescription>{t("session.moveSessionHint")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <MoveSessionForm
                    sessionId={session.id}
                    dayKey={dayKey}
                    time={format.time(session.starts_at)}
                    timeZone={tz}
                  />
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
                      <TextareaWithCount
                        id="reason"
                        name="reason"
                        maxLength={200}
                        rows={2}
                        placeholder={t("session.cancelReasonPlaceholder")}
                      />
                    </div>
                  </ConfirmDialog>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </SessionLiveProvider>
    </div>
  );
}
