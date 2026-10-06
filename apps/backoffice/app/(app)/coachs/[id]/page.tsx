import { zonedStartOfDateKey, zonedDateKey } from "@salle/shared";
import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageCrumb } from "@/components/page-crumb";
import { isManagerRole, requireTeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { getOwnCoachId } from "@/lib/coaches";
import { euros, gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { addAvailability, removeAvailability, updateCoach } from "../actions";

export const metadata: Metadata = { title: t("coaches.profileTitle") };

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

export default async function CoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireTeamContext();
  const manager = isManagerRole(context.role);
  const own = (await getOwnCoachId(context.userId, context.gym.id)) === id;
  if (!manager && !own) redirect("/?erreur=errors.forbiddenRole");

  const tz = context.gym.timezone;
  const format = gymFormatters(tz);
  const today = zonedDateKey(currentTime(), tz);
  const in4Weeks = new Date(zonedStartOfDateKey(today, tz).getTime() + 28 * 86_400_000);

  const supabase = await createClient();
  const [{ data: coach }, { data: disciplines }, { data: availabilities }, { data: sessions }] =
    await Promise.all([
      supabase
        .from("coaches")
        .select(
          "id, display_name, bio, photo_url, is_active, coach_disciplines(discipline_id), coach_compensations(hourly_rate_cents)",
        )
        .eq("id", id)
        .eq("gym_id", context.gym.id)
        .maybeSingle(),
      supabase
        .from("disciplines")
        .select("id, name, color")
        .eq("gym_id", context.gym.id)
        .order("position")
        .order("name"),
      supabase
        .from("coach_availabilities")
        .select("id, weekday, start_time, end_time, valid_until")
        .eq("coach_id", id)
        .order("weekday")
        .order("start_time"),
      supabase
        .from("class_sessions")
        .select(
          "id, starts_at, ends_at, capacity, booked_count, disciplines(name, color), session_coaches!inner(coach_id)",
        )
        .eq("session_coaches.coach_id", id)
        .eq("status", "scheduled")
        .gte("starts_at", currentTime().toISOString())
        .lt("starts_at", in4Weeks.toISOString())
        .order("starts_at"),
    ]);
  if (!coach) notFound();

  const taught = new Set(coach.coach_disciplines.map((cd) => cd.discipline_id));
  const rate = coach.coach_compensations[0]?.hourly_rate_cents ?? null;
  const hhmm = (time: string) => time.slice(0, 5);

  return (
    <div className="grid gap-6">
      <PageCrumb label={coach.display_name} />
      <PageHeader
        title={coach.display_name}
        description={
          <>
            {coach.is_active ? null : (
              <StatusPill tone="neutral">{t("coaches.inactive")}</StatusPill>
            )}
            <span>{t("coaches.freelance")}</span>
            {rate !== null ? <span>{t("coaches.rateValue", { rate: euros(rate) })}</span> : null}
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/coachs/heures">{manager ? t("coaches.hoursLink") : t("nav.myHours")}</Link>
          </Button>
        }
      />
      <Flash ok={query.ok} error={query.erreur} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("coaches.availability")}</CardTitle>
              <CardDescription>{t("coaches.availabilityHint")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {availabilities?.length ? (
                <ul className="divide-y rounded-lg border">
                  {availabilities.map((slot) => (
                    <li key={slot.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-24 font-medium">
                        {t(`weekdays.${String(slot.weekday) as (typeof WEEKDAYS)[number]}`)}
                      </span>
                      <span className="flex-1 tabular-nums">
                        {hhmm(slot.start_time)} – {hhmm(slot.end_time)}
                      </span>
                      <form action={removeAvailability}>
                        <input type="hidden" name="coachId" value={coach.id} />
                        <input type="hidden" name="availabilityId" value={slot.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("coaches.removeSlot")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("coaches.noAvailability")}</p>
              )}
              <form action={addAvailability} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="coachId" value={coach.id} />
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{t("coaches.weekday")}</span>
                  <NativeSelect name="weekday" defaultValue="1">
                    {WEEKDAYS.map((day) => (
                      <NativeSelectOption key={day} value={day}>
                        {t(`weekdays.${day}`)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{t("coaches.from")}</span>
                  <Input type="time" name="start_time" defaultValue="07:00" required step={900} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{t("coaches.to")}</span>
                  <Input type="time" name="end_time" defaultValue="12:00" required step={900} />
                </label>
                <SubmitButton variant="outline">{t("coaches.addSlot")}</SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("coaches.upcoming")}</CardTitle>
              <CardDescription>
                {t("coaches.upcomingCount", { count: sessions?.length ?? 0 })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions?.length ? (
                <ul className="-mx-2">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/planning/${s.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/50"
                      >
                        <span className="w-32 shrink-0 text-muted-foreground">
                          {format.shortDay(s.starts_at)}
                        </span>
                        <span className="w-24 shrink-0 tabular-nums">
                          {format.time(s.starts_at)} – {format.time(s.ends_at)}
                        </span>
                        <span className="flex-1">
                          <DisciplineChip
                            name={s.disciplines?.name ?? ""}
                            color={s.disciplines?.color}
                          />
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.booked_count}/{s.capacity}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("coaches.noUpcoming")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {manager ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("coaches.profile")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateCoach} className="grid gap-6">
                <input type="hidden" name="coachId" value={coach.id} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="coach-name">{t("coaches.displayName")}</FieldLabel>
                    <Input
                      id="coach-name"
                      name="display_name"
                      required
                      maxLength={80}
                      defaultValue={coach.display_name}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="coach-bio">{t("coaches.bio")}</FieldLabel>
                    <Textarea
                      id="coach-bio"
                      name="bio"
                      rows={3}
                      maxLength={500}
                      defaultValue={coach.bio ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="coach-photo">{t("coaches.photoUrl")}</FieldLabel>
                    <Input
                      id="coach-photo"
                      name="photo_url"
                      type="url"
                      placeholder="https://"
                      defaultValue={coach.photo_url ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="coach-rate">{t("coaches.hourlyRate")}</FieldLabel>
                    <Input
                      id="coach-rate"
                      name="hourly_rate"
                      inputMode="decimal"
                      className="w-32 tabular-nums"
                      defaultValue={rate === null ? "" : String(rate / 100).replace(".", ",")}
                    />
                    <FieldDescription>{t("coaches.hourlyRateHint")}</FieldDescription>
                  </Field>
                  <FieldSet>
                    <FieldLegend variant="label">{t("coaches.disciplines")}</FieldLegend>
                    <div className="grid gap-2">
                      {(disciplines ?? []).map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            name="disciplines"
                            value={d.id}
                            defaultChecked={taught.has(d.id)}
                          />
                          {d.name}
                        </label>
                      ))}
                    </div>
                  </FieldSet>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="coach-active">{t("coaches.active")}</FieldLabel>
                    <Switch id="coach-active" name="is_active" defaultChecked={coach.is_active} />
                  </Field>
                </FieldGroup>
                <SubmitButton className="w-fit">{t("common.save")}</SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
