import { zonedDateKey } from "@salle/shared";
import { RepeatIcon } from "lucide-react";
import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { DisciplineChip } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplateSwitch } from "@/components/templates/template-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { createTemplate, generateSessions, toggleTemplate } from "./actions";

export const metadata: Metadata = { title: t("templates.title") };

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const now = currentTime();
  const today = zonedDateKey(now, context.gym.timezone);
  const format = gymFormatters(context.gym.timezone);
  const in4Weeks = zonedDateKey(new Date(now.getTime() + 28 * 86_400_000), context.gym.timezone);

  const [templates, disciplines, coaches, rooms] = await Promise.all([
    supabase
      .from("class_templates")
      .select(
        "id, weekday, start_time, duration_minutes, capacity, is_active, starts_on, ends_on, disciplines(name, color), coaches(display_name), rooms(name)",
      )
      .eq("gym_id", context.gym.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("disciplines")
      .select("id, name, color")
      .eq("gym_id", context.gym.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("coaches")
      .select("id, display_name")
      .eq("gym_id", context.gym.id)
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("rooms").select("id, name, capacity").eq("gym_id", context.gym.id).order("name"),
  ]);

  const list = templates.data ?? [];
  const byDay = WEEKDAYS.map((day) => ({
    day,
    items: list.filter((tpl) => String(tpl.weekday) === day),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("templates.title")}
        description={t("templates.subtitle")}
        actions={
          <TemplateForm
            action={createTemplate}
            disciplines={disciplines.data ?? []}
            coaches={coaches.data ?? []}
            rooms={rooms.data ?? []}
            today={today}
          />
        }
      />

      <Flash ok={params.ok} error={params.erreur} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {byDay.length === 0 ? (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RepeatIcon />
              </EmptyMedia>
              <EmptyTitle>{t("templates.empty")}</EmptyTitle>
              <EmptyDescription>{t("templates.emptyHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4">
            {byDay.map(({ day, items }) => (
              <section key={day} aria-labelledby={`jour-${day}`} className="grid gap-2">
                <h2 id={`jour-${day}`} className="text-sm font-medium text-muted-foreground">
                  {t(`weekdays.${day}`)}
                </h2>
                <ul className="overflow-hidden rounded-xl bg-card shadow-border">
                  {items.map((template) => {
                    const label = `${template.disciplines?.name ?? ""} ${template.start_time.slice(0, 5)}`;
                    return (
                      <li
                        key={template.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-4 py-3 first:border-t-0",
                          !template.is_active && "text-muted-foreground",
                        )}
                      >
                        <span className="w-12 font-medium tabular-nums">
                          {template.start_time.slice(0, 5)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <DisciplineChip
                            name={template.disciplines?.name ?? ""}
                            color={template.disciplines?.color}
                          />
                          <span className="text-sm text-muted-foreground">
                            {[
                              template.coaches?.display_name ?? t("templates.noCoach"),
                              template.rooms?.name,
                              t("templates.durationShort", { minutes: template.duration_minutes }),
                              t("templates.capacityShort", { count: template.capacity }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {template.ends_on
                            ? t("templates.period", {
                                from: template.starts_on,
                                to: template.ends_on,
                              })
                            : t("templates.since", { from: format.dateKey(template.starts_on) })}
                        </span>
                        <TemplateSwitch
                          id={template.id}
                          active={template.is_active}
                          label={label}
                          action={toggleTemplate}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>{t("templates.generate")}</CardTitle>
            <CardDescription>{t("templates.generateHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={generateSessions} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="from">{t("templates.from")}</FieldLabel>
                  <Input id="from" name="from" type="date" defaultValue={today} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="to">{t("templates.to")}</FieldLabel>
                  <Input id="to" name="to" type="date" defaultValue={in4Weeks} required />
                </Field>
              </div>
              <SubmitButton variant="outline">{t("templates.generate")}</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
