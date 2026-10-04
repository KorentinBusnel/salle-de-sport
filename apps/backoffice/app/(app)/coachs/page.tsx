import { monthRange, zonedStartOfDateKey } from "@salle/shared";
import { ClockIcon, DumbbellIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/flash";
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

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const month = currentMonthKey(context);
  const range = monthRange(month);
  if (!range) throw new Error("mois invalide");
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
      .select("coach_id")
      .eq("gym_id", context.gym.id)
      .eq("status", "scheduled")
      .not("coach_id", "is", null)
      .gte("starts_at", zonedStartOfDateKey(range.from, tz).toISOString())
      .lt("starts_at", zonedStartOfDateKey(`${range.next}-01`, tz).toISOString()),
  ]);
  if (error) throw new Error(error.message);
  const minutesBy = new Map((hours ?? []).map((h) => [h.coach_id, h.minutes]));
  const sessionsBy = new Map<string, number>();
  for (const s of sessions ?? [])
    if (s.coach_id) sessionsBy.set(s.coach_id, (sessionsBy.get(s.coach_id) ?? 0) + 1);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("coaches.title")}
        description={t("coaches.count", { count: coaches?.length ?? 0 })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/coachs/heures">
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
        <div className="overflow-hidden rounded-xl bg-card shadow-border">
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">{t("coaches.name")}</TableHead>
                <TableHead>{t("coaches.disciplines")}</TableHead>
                <TableHead className="text-right">{t("coaches.sessionsThisMonth")}</TableHead>
                <TableHead className="pr-4 text-right">{t("coaches.hoursThisMonth")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((coach) => (
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
