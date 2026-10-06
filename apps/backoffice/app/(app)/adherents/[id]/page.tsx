import {
  BOOKING_STATUS_TONE,
  formatMoney,
  formatPrice,
  MEMBER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  SUBSCRIPTION_STATUS_TONE,
} from "@salle/shared";
import {
  CalendarCheckIcon,
  MailIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PhoneIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SaleSheet } from "@/components/billing/sale-sheet";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { Flash } from "@/components/flash";
import { MemberSummary } from "@/components/assistant/member-summary";
import { EditableCell } from "@/components/inline/editable-cell";
import { ActivateButton } from "@/components/members/activate-button";
import { CreditsDialog } from "@/components/members/credits-dialog";
import { MemberOverview } from "@/components/members/member-overview";
import { SectionError } from "@/components/section-error";
import { CardsSkeleton } from "@/components/skeletons";
import { ReceiptLink } from "@/components/payments/receipt-link";
import { ConsentSwitches } from "@/components/members/profile/consent-switches";
import { MemberTags } from "@/components/members/profile/member-tags";
import { StatusButton } from "@/components/members/profile/status-button";
import { SegmentMeter } from "@/components/segment-meter";
import { TextareaWithCount } from "@/components/forms/textarea-with-count";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageCrumb } from "@/components/page-crumb";
import { isFrontDeskRole, isManagerRole, requireRole, type TeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { adjustCredits } from "../actions";
import { addNote, bookFromProfile, saveCareNote, updateMemberField } from "./actions";

export const metadata: Metadata = { title: t("memberProfile.title") };

const TABS = ["historique", "reservations", "paiements", "profil"] as const;
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
  const config = await getGymConfig(context.gym.id);
  const settings = config.settings;
  const creditLimit = config.private.credit_adjust_max;
  const format = gymFormatters(context.gym.timezone);
  const tabs: Tab[] = manager ? [...TABS] : ["reservations", "profil"];
  const tab = tabs.find((x) => x === query.onglet) ?? tabs[0] ?? "profil";
  const path = `/adherents/${id}?onglet=${tab}`;

  const supabase = await createClient();
  // En-tête : fiche, note « à savoir », solde et abonnement (gérant), chargés ensemble.
  const canSell = manager || settings.staff_can_sell;
  const [{ data: member }, { data: careNote }, ledgerRes, subscriptionRes, plansRes] =
    await Promise.all([
      supabase
        .from("members")
        .select(
          "id, first_name, last_name, email, phone, status, tags, acquisition_source, created_at, marketing_email_consent_at, marketing_whatsapp_consent_at, profiles(birth_date)",
        )
        .eq("id", id)
        .eq("gym_id", context.gym.id)
        .maybeSingle(),
      supabase
        .from("member_care_notes")
        .select("note, updated_at")
        .eq("member_id", id)
        .maybeSingle(),
      manager
        ? supabase.from("credit_ledger").select("delta, reason").eq("member_id", id)
        : Promise.resolve({ data: [] as { delta: number; reason: string }[] }),
      manager
        ? supabase
            .from("subscriptions")
            .select("status, plans(name)")
            .eq("member_id", id)
            .in("status", ["active", "trialing", "past_due"])
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      canSell
        ? supabase
            .from("plans")
            .select(
              "id, name, type, price_cents, currency, billing_interval, audience, requires_proof",
            )
            .eq("gym_id", context.gym.id)
            .eq("is_active", true)
            .order("position")
            .order("name")
        : Promise.resolve({ data: [] }),
    ]);
  if (!member) notFound();
  const name = `${member.first_name} ${member.last_name}`;
  const ledger = ledgerRes.data ?? [];
  const balance = ledger.reduce((sum, row) => sum + row.delta, 0);
  const used = ledger
    .filter((row) => row.reason === "booking" || row.reason === "expiration")
    .reduce((sum, row) => sum - row.delta, 0);
  const subscription = subscriptionRes.data;
  const canSuspend = manager || settings.staff_can_suspend_members;

  return (
    <div className="grid gap-6">
      <PageCrumb label={name} />
      <PageHeader
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
              <ActivateButton memberId={member.id} name={name} />
            ) : null}
            {member.status === "active" && canSuspend ? (
              <StatusButton memberId={member.id} name={name} to="suspended" />
            ) : null}
            {member.status === "suspended" && canSuspend ? (
              <StatusButton memberId={member.id} name={name} to="active" />
            ) : null}
            {canSell ? (
              <SaleSheet
                memberId={member.id}
                memberName={name}
                hasSubscription={Boolean(subscription && subscription.status !== "past_due")}
                plans={(plansRes.data ?? []).map((p) => ({
                  id: p.id,
                  name: p.name,
                  price: formatPrice(p),
                  type: p.type,
                  audience: p.audience,
                  requiresProof: p.requires_proof,
                }))}
              />
            ) : null}
            {manager ? (
              <CreditsDialog
                memberId={member.id}
                memberName={name}
                balance={balance}
                returnQuery=""
                returnTo={path}
                canRemove={settings.manager_can_remove_credits}
                limit={creditLimit}
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
      {/* Synthèse (accueil et gérant), chargée à part : une erreur reste locale au bloc. */}
      <section aria-label={t("memberOverview.title")}>
        <SectionError>
          <Suspense fallback={<CardsSkeleton count={manager ? 4 : 3} height="h-52" />}>
            <MemberOverview
              memberId={member.id}
              timeZone={context.gym.timezone}
              manager={manager}
            />
          </Suspense>
        </SectionError>
      </section>
      {manager && balance + used > 0 ? (
        <SegmentMeter
          label={t("memberProfile.creditsMeter")}
          className="max-w-md"
          segments={[
            { label: t("memberProfile.creditsLeft"), value: Math.max(0, balance), tone: "brand" },
            { label: t("memberProfile.creditsUsed"), value: used, tone: "neutral" },
          ]}
        />
      ) : null}

      <nav
        aria-label={t("memberProfile.tabs")}
        className="flex w-fit gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((x) => (
          <Link
            key={x}
            href={`/adherents/${member.id}?onglet=${x}`}
            scroll={false}
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

      {/* Chaque onglet se charge à part : l'en-tête reste affiché pendant le changement. */}
      <Suspense key={tab} fallback={<TabSkeleton />}>
        {tab === "historique" ? (
          <HistoryTab context={context} memberId={member.id} path={path} tab={tab} />
        ) : tab === "paiements" ? (
          <BillingTab context={context} memberId={member.id} />
        ) : tab === "reservations" ? (
          <BookingsTab
            context={context}
            memberId={member.id}
            active={member.status === "active"}
            path={path}
            tab={tab}
          />
        ) : (
          <ProfileTab
            member={member}
            careNote={careNote?.note ?? ""}
            path={path}
            tab={tab}
            timeZone={context.gym.timezone}
          />
        )}
      </Suspense>
    </div>
  );
}

/**
 * Abonnement et paiements (gérant) : abonnement en cours (période, engagement, renouvellement
 * d'un abonnement suivi à la main), crédits par lot avec leur date d'expiration, paiements.
 */
async function BillingTab({ context, memberId }: { context: TeamContext; memberId: string }) {
  const supabase = await createClient();
  const format = gymFormatters(context.gym.timezone);
  const [{ data: subs }, { data: ledger }, { data: payments }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, status, started_at, current_period_end, commitment_ends_at, cancel_at, stripe_subscription_id, plans(name, price_cents, currency, billing_interval)",
      )
      .eq("member_id", memberId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("credit_ledger")
      .select("id, lot_id, delta, reason, expires_at, created_at, plans(name)")
      .eq("member_id", memberId)
      .order("created_at"),
    supabase
      .from("payments")
      .select("id, amount_cents, currency, status, method, description, paid_at, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const now = currentTime().getTime();
  const lots = (ledger ?? [])
    .filter((row) => row.lot_id === row.id)
    .map((lot) => ({
      ...lot,
      remaining: (ledger ?? [])
        .filter((row) => row.lot_id === lot.id)
        .reduce((sum, row) => sum + row.delta, 0),
    }))
    .filter((lot) => lot.remaining > 0 && (!lot.expires_at || Date.parse(lot.expires_at) > now));
  const current = (subs ?? []).find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const manual = current && !current.stripe_subscription_id;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.payments")}</CardTitle>
          <CardDescription>{t("billing.paymentsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {payments?.length ? (
            <ul className="divide-y">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-2 text-sm"
                >
                  <span className="w-28 text-muted-foreground tabular-nums">
                    {format.dateTime(p.paid_at ?? p.created_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.description ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`billing.methodLabel.${p.method}`)}
                  </span>
                  <StatusPill tone={PAYMENT_STATUS_TONE[p.status]}>
                    {t(`billing.paymentStatus.${p.status}`)}
                  </StatusPill>
                  <span className="w-24 text-right font-medium tabular-nums">
                    {formatMoney(p.amount_cents, p.currency)}
                  </span>
                  <span className="w-8">
                    {p.status === "succeeded" || p.status === "refunded" ? (
                      <ReceiptLink
                        paymentId={p.id}
                        date={format.dateTime(p.paid_at ?? p.created_at)}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-sm text-muted-foreground">{t("billing.noPayments")}</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.subscription")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {current ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{current.plans?.name}</span>
                  <StatusPill tone={SUBSCRIPTION_STATUS_TONE[current.status]}>
                    {t(`billing.subscriptionStatus.${current.status}`)}
                  </StatusPill>
                </div>
                {current.plans ? (
                  <p className="text-muted-foreground">{formatPrice(current.plans)}</p>
                ) : null}
                {current.current_period_end ? (
                  <p>
                    {t(current.cancel_at ? "billing.endsOn" : "billing.periodEnd", {
                      date: format.longDayInline(current.current_period_end),
                    })}
                  </p>
                ) : null}
                {current.commitment_ends_at && Date.parse(current.commitment_ends_at) > now ? (
                  <p className="text-muted-foreground">
                    {t("billing.commitmentUntil", {
                      date: format.longDayInline(current.commitment_ends_at),
                    })}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t(manual ? "billing.manualSubscription" : "billing.stripeSubscription")}
                </p>
                {manual ? (
                  <SubscriptionActions
                    subscriptionId={current.id}
                    price={current.plans ? formatPrice(current.plans) : ""}
                    canRenew={!current.cancel_at}
                    canCancel={!current.cancel_at}
                  />
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">{t("memberProfile.noSubscription")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.lots")}</CardTitle>
            <CardDescription>{t("billing.lotsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {lots.length ? (
              <ul className="grid gap-2 text-sm">
                {lots.map((lot) => (
                  <li key={lot.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {lot.plans?.name ?? t("billing.manualCredits")}
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="font-medium">
                        {t("memberProfile.credits", { count: lot.remaining })}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {lot.expires_at
                          ? t("billing.expiresOn", { date: format.longDayInline(lot.expires_at) })
                          : t("billing.noExpiry")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("billing.noLots")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function Hidden({ memberId, tab, path }: { memberId: string; tab: Tab; path: string }) {
  return Object.entries({ memberId, tab, returnTo: path }).map(([k, v]) => (
    <input key={k} type="hidden" name={k} value={v} />
  ));
}

/** Historique (gérant) : échanges, notes et séances suivies, par date ; ajout d'une note. */
async function HistoryTab({
  context,
  memberId,
  path,
  tab,
}: {
  context: TeamContext;
  memberId: string;
  path: string;
  tab: Tab;
}) {
  const supabase = await createClient();
  const format = gymFormatters(context.gym.timezone);
  const [interactionsRes, bookingsRes] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, channel, direction, subject, summary, occurred_at")
      .eq("member_id", memberId)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("bookings")
      .select("id, status, booked_at, class_sessions(starts_at, disciplines(name))")
      .eq("member_id", memberId)
      .in("status", ["attended", "no_show"])
      .order("booked_at", { ascending: false })
      .limit(50),
  ]);
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
    ...(bookingsRes.data ?? []).map((b) => ({
      key: `b-${b.id}`,
      at: b.class_sessions?.starts_at ?? b.booked_at,
      icon: CalendarCheckIcon,
      title: `${b.class_sessions?.disciplines?.name ?? ""} · ${t(`bookingStatus.${b.status}`)}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
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
            <Hidden memberId={memberId} tab={tab} path={path} />
            <TextareaWithCount
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
  );
}

/** Réservations : à venir, passées (bilan de présence), inscription à une séance. */
async function BookingsTab({
  context,
  memberId,
  active,
  path,
  tab,
}: {
  context: TeamContext;
  memberId: string;
  active: boolean;
  path: string;
  tab: Tab;
}) {
  const supabase = await createClient();
  const format = gymFormatters(context.gym.timezone);
  const now = currentTime();
  const [bookingsRes, upcomingRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, booked_at, class_sessions(id, starts_at, ends_at, status, disciplines(name, color))",
      )
      .eq("member_id", memberId)
      .order("booked_at", { ascending: false })
      .limit(100),
    active
      ? supabase
          .from("class_sessions")
          .select("id, starts_at, booked_count, capacity, disciplines(name)")
          .eq("gym_id", context.gym.id)
          .eq("status", "scheduled")
          .gt("starts_at", now.toISOString())
          .lt("starts_at", new Date(now.getTime() + 8 * 86_400_000).toISOString())
          .order("starts_at")
      : Promise.resolve({ data: [] }),
  ]);
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
  const bookedIds = new Set(
    bookings.filter((b) => b.status !== "cancelled").map((b) => b.class_sessions?.id),
  );
  const countOf = (status: string) => past.filter((b) => b.status === status).length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6">
        {past.length ? (
          <SegmentMeter
            label={t("memberProfile.bookingsMeter")}
            segments={[
              { label: t("bookingStatus.attended"), value: countOf("attended"), tone: "success" },
              { label: t("bookingStatus.no_show"), value: countOf("no_show"), tone: "danger" },
              { label: t("bookingStatus.cancelled"), value: countOf("cancelled"), tone: "neutral" },
            ]}
          />
        ) : null}
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
                        <span className="w-32 text-muted-foreground tabular-nums">
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
      {active ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("memberProfile.book")}</CardTitle>
            <CardDescription>{t("memberProfile.bookHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={bookFromProfile} className="grid gap-3">
              <Hidden memberId={memberId} tab={tab} path={path} />
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
  );
}

type ProfileMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  acquisition_source: string | null;
  marketing_email_consent_at: string | null;
  marketing_whatsapp_consent_at: string | null;
  profiles: { birth_date: string | null } | null;
};

/** Profil : note « à savoir », coordonnées modifiables sur place, étiquettes, consentements. */
function ProfileTab({
  member,
  careNote,
  path,
  tab,
  timeZone,
}: {
  member: ProfileMember;
  careNote: string;
  path: string;
  tab: Tab;
  timeZone: string;
}) {
  const format = gymFormatters(timeZone);
  const cell = { id: member.id, action: updateMemberField };
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("memberProfile.careNote")}</CardTitle>
          <CardDescription>{t("memberProfile.careNoteHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveCareNote} className="grid gap-3">
            <Hidden memberId={member.id} tab={tab} path={path} />
            <TextareaWithCount
              name="careNote"
              defaultValue={careNote}
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
          <CardDescription>{t("memberProfile.contactHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-1 text-sm">
            {(
              [
                ["first_name", "members.new.firstName", member.first_name],
                ["last_name", "members.new.lastName", member.last_name],
                ["email", "members.new.email", member.email ?? ""],
                ["phone", "members.new.phone", member.phone ?? ""],
                ["acquisition_source", "memberProfile.source", member.acquisition_source ?? ""],
              ] as const
            ).map(([field, label, value]) => (
              <div
                key={field}
                className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-2 max-sm:grid-cols-1"
              >
                <dt className="text-muted-foreground">{t(label)}</dt>
                <dd className="min-w-0">
                  <EditableCell
                    {...cell}
                    kind="text"
                    field={field}
                    label={t(label)}
                    value={value}
                    maxLength={field === "email" ? 200 : field === "phone" ? 30 : 80}
                  />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            {member.profiles?.birth_date
              ? t("memberProfile.birthDate", { date: format.dateKey(member.profiles.birth_date) })
              : t("memberProfile.noBirthDate")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("memberProfile.tags")}</CardTitle>
            <CardDescription>{t("memberProfile.tagsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <MemberTags memberId={member.id} tags={member.tags} />
            {member.tags.length ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {member.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/adherents?tag=${encodeURIComponent(tag)}`}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {t("memberProfile.sameTag", { tag })}
                  </Link>
                ))}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("memberProfile.consents")}</CardTitle>
            <CardDescription>{t("memberProfile.consentsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsentSwitches
              memberId={member.id}
              consents={{
                email: member.marketing_email_consent_at,
                whatsapp: member.marketing_whatsapp_consent_at,
              }}
              formatDate={{
                email: member.marketing_email_consent_at
                  ? format.dateTime(member.marketing_email_consent_at)
                  : null,
                whatsapp: member.marketing_whatsapp_consent_at
                  ? format.dateTime(member.marketing_whatsapp_consent_at)
                  : null,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
