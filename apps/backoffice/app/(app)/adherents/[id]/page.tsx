import { BOOKING_STATUS_TONE, MEMBER_STATUS_TONE } from "@salle/shared";
import {
  CalendarCheckIcon,
  MailIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PhoneIcon,
  XIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Flash } from "@/components/flash";
import { MemberSummary } from "@/components/assistant/member-summary";
import { CreditsDialog } from "@/components/members/credits-dialog";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { adjustCredits, setMemberStatus } from "../actions";
import {
  addNote,
  addTag,
  bookFromProfile,
  removeTag,
  saveCareNote,
  setConsent,
  updateContact,
} from "./actions";

export const metadata: Metadata = { title: t("memberProfile.title") };

const TABS = ["historique", "reservations", "profil"] as const;
type Tab = (typeof TABS)[number];

const CHANNEL_ICON = {
  email: MailIcon,
  whatsapp: MessageCircleIcon,
  phone: PhoneIcon,
  note: NotebookPenIcon,
} as const;

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string; ok?: string; erreur?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const context = await requireRole(isFrontDeskRole);
  const manager = isManagerRole(context.role);
  const settings = await getGymSettings(context.gym.id);
  const format = gymFormatters(context.gym.timezone);
  const now = currentTime();
  const tabs: Tab[] = manager ? [...TABS] : ["reservations", "profil"];
  const tab = tabs.find((x) => x === query.onglet) ?? tabs[0] ?? "profil";
  const path = `/adherents/${id}?onglet=${tab}`;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select(
      "id, first_name, last_name, email, phone, status, tags, acquisition_source, created_at, marketing_email_consent_at, marketing_whatsapp_consent_at, profiles(birth_date)",
    )
    .eq("id", id)
    .eq("gym_id", context.gym.id)
    .maybeSingle();
  if (!member) notFound();
  const name = `${member.first_name} ${member.last_name}`;

  const { data: careNote } = await supabase
    .from("member_care_notes")
    .select("note, updated_at")
    .eq("member_id", id)
    .maybeSingle();

  const [bookingsRes, ledgerRes, subscriptionRes, interactionsRes, upcomingRes] = await Promise.all(
    [
      supabase
        .from("bookings")
        .select(
          "id, status, booked_at, class_sessions(id, starts_at, ends_at, status, disciplines(name, color))",
        )
        .eq("member_id", id)
        .order("booked_at", { ascending: false })
        .limit(100),
      manager
        ? supabase.from("credit_ledger").select("delta").eq("member_id", id)
        : Promise.resolve({ data: [] as { delta: number }[] }),
      manager
        ? supabase
            .from("subscriptions")
            .select("status, plans(name)")
            .eq("member_id", id)
            .in("status", ["active", "trialing", "past_due"])
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      manager
        ? supabase
            .from("interactions")
            .select("id, channel, direction, subject, summary, occurred_at")
            .eq("member_id", id)
            .order("occurred_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      tab === "reservations"
        ? supabase
            .from("class_sessions")
            .select("id, starts_at, booked_count, capacity, disciplines(name)")
            .eq("gym_id", context.gym.id)
            .eq("status", "scheduled")
            .gt("starts_at", now.toISOString())
            .lt("starts_at", new Date(now.getTime() + 8 * 86_400_000).toISOString())
            .order("starts_at")
        : Promise.resolve({ data: [] }),
    ],
  );
  const bookings = (bookingsRes.data ?? [])
    .filter((b) => b.class_sessions)
    .sort((a, b) =>
      (b.class_sessions?.starts_at ?? "").localeCompare(a.class_sessions?.starts_at ?? ""),
    );
  const upcoming = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "waitlisted") &&
      Date.parse(b.class_sessions?.starts_at ?? "") > now.getTime(),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));
  const balance = (ledgerRes.data ?? []).reduce((sum, row) => sum + row.delta, 0);
  const subscription = subscriptionRes.data;
  const bookedIds = new Set(
    bookings.filter((b) => b.status !== "cancelled").map((b) => b.class_sessions?.id),
  );

  // Historique : interactions (messages, notes, échanges) et séances suivies, par date.
  type Entry = { key: string; at: string; icon: typeof MailIcon; title: string; body?: string };
  const timeline: Entry[] = [
    ...(interactionsRes.data ?? []).map((i) => ({
      key: `i-${i.id}`,
      at: i.occurred_at,
      icon: CHANNEL_ICON[i.channel],
      title:
        i.subject ??
        t(i.channel === "note" ? "memberProfile.note" : `memberProfile.channel.${i.channel}`),
      ...(i.summary ? { body: i.summary } : {}),
    })),
    ...past
      .filter((b) => b.status === "attended" || b.status === "no_show")
      .map((b) => ({
        key: `b-${b.id}`,
        at: b.class_sessions?.starts_at ?? b.booked_at,
        icon: CalendarCheckIcon,
        title: `${b.class_sessions?.disciplines?.name ?? ""} · ${t(`bookingStatus.${b.status}`)}`,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const canSuspend = manager || settings.staff_can_suspend_members;
  const hidden = (extra: Record<string, string> = {}) =>
    Object.entries({ memberId: member.id, tab, returnTo: path, ...extra }).map(([k, v]) => (
      <input key={k} type="hidden" name={k} value={v} />
    ));

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/adherents">{t("members.title")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>{name}</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={name}
        description={
          <>
            <StatusPill tone={MEMBER_STATUS_TONE[member.status]}>
              {t(`memberStatus.${member.status}`)}
            </StatusPill>
            {manager ? <span>{t("memberProfile.credits", { count: balance })}</span> : null}
            {manager ? (
              <span>{subscription?.plans?.name ?? t("memberProfile.noSubscription")}</span>
            ) : null}
            <span>
              {t("memberProfile.since", { date: format.longDayInline(member.created_at) })}
            </span>
          </>
        }
        actions={
          <>
            {manager ? <MemberSummary memberId={member.id} name={name} /> : null}
            {member.status === "prospect" ? (
              <form action={setMemberStatus}>
                {hidden({ status: "active" })}
                <SubmitButton size="sm">{t("members.activate")}</SubmitButton>
              </form>
            ) : null}
            {member.status === "active" && canSuspend ? (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    {t("members.suspend")}
                  </Button>
                }
                title={t("members.suspendTitle")}
                description={t("members.suspendBody", { name })}
                confirmLabel={t("members.suspend")}
                action={setMemberStatus}
                fields={{ memberId: member.id, status: "suspended", returnTo: path }}
              />
            ) : null}
            {member.status === "suspended" && canSuspend ? (
              <form action={setMemberStatus}>
                {hidden({ status: "active" })}
                <SubmitButton size="sm" variant="outline">
                  {t("members.reactivate")}
                </SubmitButton>
              </form>
            ) : null}
            {manager ? (
              <CreditsDialog
                memberId={member.id}
                memberName={name}
                balance={balance}
                returnQuery=""
                returnTo={path}
                canRemove={settings.manager_can_remove_credits}
                action={adjustCredits}
              />
            ) : null}
          </>
        }
      />
      <Flash ok={query.ok} error={query.erreur} />
      {careNote ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm ring-1 ring-warning/25">
          <NotebookPenIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <span className="font-medium">{t("memberProfile.careNote")} : </span>
            {careNote.note}
          </span>
        </p>
      ) : null}

      <nav
        aria-label={t("memberProfile.tabs")}
        className="flex w-fit gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((x) => (
          <Link
            key={x}
            href={`/adherents/${member.id}?onglet=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
              x === tab
                ? "bg-card font-medium text-foreground shadow-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`memberProfile.tab.${x}`)}
          </Link>
        ))}
      </nav>

      {tab === "historique" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardHeader>
              <CardTitle>{t("memberProfile.timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("memberProfile.timelineEmpty")}</p>
              ) : (
                <ol className="relative grid gap-5 border-l pl-6">
                  {timeline.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <li key={entry.key} className="relative">
                        <span className="absolute top-0 -left-[2.1rem] flex size-6 items-center justify-center rounded-full bg-card shadow-border">
                          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                        </span>
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                          <span className="font-medium">{entry.title}</span>
                          <time dateTime={entry.at} className="text-xs text-muted-foreground">
                            {format.dateTime(entry.at)}
                          </time>
                        </p>
                        {entry.body ? (
                          <p className="mt-1 max-w-prose text-sm whitespace-pre-line text-muted-foreground">
                            {entry.body}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("memberProfile.addNote")}</CardTitle>
              <CardDescription>{t("memberProfile.addNoteHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addNote} className="grid gap-3">
                {hidden()}
                <Textarea
                  name="note"
                  rows={4}
                  maxLength={2000}
                  required
                  aria-label={t("memberProfile.addNote")}
                />
                <SubmitButton className="w-fit">{t("memberProfile.saveNote")}</SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "reservations" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6">
            {[
              { title: t("memberProfile.upcoming"), rows: upcoming },
              { title: t("memberProfile.past"), rows: past.slice(0, 30) },
            ].map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle>
                    {group.title}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {group.rows.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {group.rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("memberProfile.noBookings")}</p>
                  ) : (
                    <ul className="-mx-2">
                      {group.rows.map((b) => (
                        <li key={b.id}>
                          <Link
                            href={`/planning/${b.class_sessions?.id}`}
                            className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/50"
                          >
                            <span className="w-32 text-muted-foreground">
                              {format.shortDay(b.class_sessions?.starts_at ?? b.booked_at)}{" "}
                              {format.time(b.class_sessions?.starts_at ?? b.booked_at)}
                            </span>
                            <span className="flex-1">
                              <DisciplineChip
                                name={b.class_sessions?.disciplines?.name ?? ""}
                                color={b.class_sessions?.disciplines?.color}
                              />
                            </span>
                            <StatusPill tone={BOOKING_STATUS_TONE[b.status]}>
                              {t(`bookingStatus.${b.status}`)}
                            </StatusPill>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {member.status === "active" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("memberProfile.book")}</CardTitle>
                <CardDescription>{t("memberProfile.bookHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={bookFromProfile} className="grid gap-3">
                  {hidden()}
                  <NativeSelect name="sessionId" required aria-label={t("memberProfile.book")}>
                    {(upcomingRes.data ?? [])
                      .filter((s) => !bookedIds.has(s.id))
                      .map((s) => (
                        <NativeSelectOption key={s.id} value={s.id}>
                          {format.shortDay(s.starts_at)} {format.time(s.starts_at)} ·{" "}
                          {s.disciplines?.name} · {s.booked_count}/{s.capacity}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                  <SubmitButton className="w-fit">{t("memberProfile.bookSubmit")}</SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "profil" ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("memberProfile.careNote")}</CardTitle>
              <CardDescription>{t("memberProfile.careNoteHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveCareNote} className="grid gap-3">
                {hidden()}
                <Textarea
                  name="careNote"
                  defaultValue={careNote?.note ?? ""}
                  maxLength={500}
                  rows={2}
                  aria-label={t("memberProfile.careNote")}
                  placeholder={t("memberProfile.careNotePlaceholder")}
                />
                <SubmitButton size="sm" variant="outline" className="w-fit">
                  {t("memberProfile.careNoteSave")}
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("memberProfile.contact")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateContact} className="grid gap-6">
                {hidden()}
                <FieldGroup>
                  {(
                    [
                      ["first_name", "members.new.firstName", "text", member.first_name],
                      ["last_name", "members.new.lastName", "text", member.last_name],
                      ["email", "members.new.email", "email", member.email ?? ""],
                      ["phone", "members.new.phone", "tel", member.phone ?? ""],
                      [
                        "acquisition_source",
                        "memberProfile.source",
                        "text",
                        member.acquisition_source ?? "",
                      ],
                    ] as const
                  ).map(([field, label, type, value]) => (
                    <Field key={field}>
                      <FieldLabel htmlFor={`m-${field}`}>{t(label)}</FieldLabel>
                      <Input id={`m-${field}`} name={field} type={type} defaultValue={value} />
                    </Field>
                  ))}
                </FieldGroup>
                <p className="text-sm text-muted-foreground">
                  {member.profiles?.birth_date
                    ? t("memberProfile.birthDate", {
                        date: format.dateKey(member.profiles.birth_date),
                      })
                    : t("memberProfile.noBirthDate")}
                </p>
                <SubmitButton className="w-fit">{t("common.save")}</SubmitButton>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("memberProfile.tags")}</CardTitle>
                <CardDescription>{t("memberProfile.tagsHint")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {member.tags.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {member.tags.map((tag) => (
                      <li
                        key={tag}
                        className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3 text-sm"
                      >
                        <Link
                          href={`/adherents?tag=${encodeURIComponent(tag)}`}
                          className="hover:underline"
                        >
                          {tag}
                        </Link>
                        <form action={removeTag}>
                          {hidden({ tag })}
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("memberProfile.removeTag", { tag })}
                          >
                            <XIcon />
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("memberProfile.noTags")}</p>
                )}
                <form action={addTag} className="flex gap-2">
                  {hidden()}
                  <Input
                    name="tag"
                    maxLength={40}
                    required
                    placeholder={t("memberProfile.tagPlaceholder")}
                    aria-label={t("memberProfile.addTag")}
                  />
                  <SubmitButton variant="outline">{t("memberProfile.addTag")}</SubmitButton>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("memberProfile.consents")}</CardTitle>
                <CardDescription>{t("memberProfile.consentsHint")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(
                  [
                    ["email", member.marketing_email_consent_at],
                    ["whatsapp", member.marketing_whatsapp_consent_at],
                  ] as const
                ).map(([channel, at]) => (
                  <form
                    key={channel}
                    action={setConsent}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    {hidden({ channel, granted: at ? "false" : "true" })}
                    <span className="text-sm">
                      <span className="block font-medium">
                        {t(`memberProfile.consent.${channel}`)}
                      </span>
                      <span className="text-muted-foreground">
                        {at
                          ? t("memberProfile.consentSince", { date: format.dateTime(at) })
                          : t("memberProfile.noConsent")}
                      </span>
                    </span>
                    <SubmitButton size="sm" variant="outline">
                      {at ? t("memberProfile.withdraw") : t("memberProfile.grant")}
                    </SubmitButton>
                  </form>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
