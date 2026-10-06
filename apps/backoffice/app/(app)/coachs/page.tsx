import { monthRange, zonedStartOfDateKey } from "@salle/shared";
import { ClockIcon, DumbbellIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SortHead } from "@/components/data-table/sort-head";
import { Flash } from "@/components/flash";
import { MonthNav } from "@/components/forms/month-nav";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentMonthKey } from "@/lib/coaches";
import { hoursLabel, initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createCoach } from "./actions";

export const metadata: Metadata = { title: t("coaches.title") };

const SORTS = ["name", "name_desc", "sessions", "hours"] as const;

/** Coachs : séances et heures du mois choisi, tri par colonne, création en panneau latéral. */
export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; mois?: string; tri?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const thisMonth = currentMonthKey(context);
  const month = params.mois && monthRange(params.mois) ? params.mois : thisMonth;
  const range = monthRange(month);
  if (!range) throw new Error("mois invalide");
  const sort = SORTS.find((s) => s === params.tri) ?? "name";
  const tz = context.gym.timezone;

  const supabase = await createClient();
  const [{ data: coaches, error }, { data: hours }, { data: sessions }] = await Promise.all([
    supabase
      .from("coaches")
      .select(
        "id, display_name, photo_url, is_active, coach_disciplines(disciplines(id, name, color))",
      )
      .eq("gym_id", context.gym.id)
      .order("is_active", { ascending: false })
      .order("display_name"),
    supabase.rpc("coach_hours", { p_gym_id: context.gym.id, p_from: range.from, p_to: range.to }),
    supabase
      .from("class_sessions")
      .select("session_coaches(coach_id)")
      .eq("gym_id", context.gym.id)
      .eq("status", "scheduled")
      .gte("starts_at", zonedStartOfDateKey(range.from, tz).toISOString())
      .lt("starts_at", zonedStartOfDateKey(`${range.next}-01`, tz).toISOString()),
  ]);
  if (error) throw new Error(error.message);
  const minutesBy = new Map((hours ?? []).map((h) => [h.coach_id, h.minutes]));
  const sessionsBy = new Map<string, number>();
  // Chaque coach assigné compte la séance (plusieurs coachs possibles).
  for (const s of sessions ?? [])
    for (const { coach_id } of s.session_coaches)
      sessionsBy.set(coach_id, (sessionsBy.get(coach_id) ?? 0) + 1);

  // Tri : actifs d'abord, puis la colonne choisie (nombres du plus grand au plus petit).
  const rows = [...(coaches ?? [])].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    const byName = a.display_name.localeCompare(b.display_name, "fr");
    if (sort === "name") return byName;
    if (sort === "name_desc") return -byName;
    const value = (id: string) =>
      sort === "sessions" ? (sessionsBy.get(id) ?? 0) : (minutesBy.get(id) ?? 0);
    return value(b.id) - value(a.id) || byName;
  });
  const href = (tri: string) => {
    const query = new URLSearchParams();
    if (month !== thisMonth) query.set("mois", month);
    if (tri !== "name") query.set("tri", tri);
    const text = query.toString();
    return `/coachs${text ? `?${text}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("coaches.title")}
        description={t("coaches.count", { count: coaches?.length ?? 0 })}
        actions={
          <>
            <MonthNav month={month} previous={range.previous} next={range.next} />
            <Button asChild variant="outline">
              <Link href={`/coachs/heures?mois=${month}`}>
                <ClockIcon data-icon="inline-start" />
                {t("coaches.hoursLink")}
              </Link>
            </Button>
            <NewCoachSheet />
          </>
        }
      />
      <Flash ok={params.ok} error={params.erreur} />

      {!coaches?.length ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DumbbellIcon />
            </EmptyMedia>
            <EmptyTitle>{t("coaches.empty")}</EmptyTitle>
            <EmptyDescription>{t("coaches.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card shadow-border">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <SortHead
                  className="pl-4"
                  label={t("coaches.name")}
                  href={href(sort === "name" ? "name_desc" : "name")}
                  direction={sort === "name" ? "asc" : sort === "name_desc" ? "desc" : null}
                />
                <TableHead>{t("coaches.disciplines")}</TableHead>
                <SortHead
                  className="text-right"
                  label={t("coaches.sessionsThisMonth")}
                  href={href("sessions")}
                  direction={sort === "sessions" ? "desc" : null}
                />
                <SortHead
                  className="pr-4 text-right"
                  label={t("coaches.hoursThisMonth")}
                  href={href("hours")}
                  direction={sort === "hours" ? "desc" : null}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((coach) => (
                <TableRow key={coach.id} className="relative">
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {coach.photo_url ? <AvatarImage src={coach.photo_url} alt="" /> : null}
                        <AvatarFallback className="text-xs">
                          {initials(coach.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      {/* Lien étiré : toute la ligne ouvre la fiche. */}
                      <Link
                        href={`/coachs/${coach.id}`}
                        className="font-medium after:absolute after:inset-0 hover:underline"
                      >
                        {coach.display_name}
                      </Link>
                      {coach.is_active ? null : (
                        <StatusPill tone="neutral">{t("coaches.inactive")}</StatusPill>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {coach.coach_disciplines.map((cd) =>
                        cd.disciplines ? (
                          <DisciplineChip
                            key={cd.disciplines.id}
                            name={cd.disciplines.name}
                            color={cd.disciplines.color}
                          />
                        ) : null,
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sessionsBy.get(coach.id) ?? 0}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {hoursLabel(minutesBy.get(coach.id) ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("coaches.monthHint")}</p>
    </div>
  );
}

function NewCoachSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          {t("coaches.new")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form action={createCoach} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{t("coaches.new")}</SheetTitle>
            <SheetDescription>{t("coaches.newHint")}</SheetDescription>
          </SheetHeader>
          <FieldGroup className="flex-1 px-4">
            <Field>
              <FieldLabel htmlFor="new-coach-name">{t("coaches.displayName")}</FieldLabel>
              <Input id="new-coach-name" name="display_name" required maxLength={80} />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-coach-bio">{t("coaches.bio")}</FieldLabel>
              <Textarea id="new-coach-bio" name="bio" maxLength={500} rows={3} />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-coach-photo">{t("coaches.photoUrl")}</FieldLabel>
              <Input id="new-coach-photo" name="photo_url" type="url" placeholder="https://" />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-coach-rate">{t("coaches.hourlyRate")}</FieldLabel>
              <Input
                id="new-coach-rate"
                name="hourly_rate"
                inputMode="decimal"
                className="w-32 tabular-nums"
              />
            </Field>
          </FieldGroup>
          <SheetFooter>
            <SubmitButton>{t("coaches.create")}</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
