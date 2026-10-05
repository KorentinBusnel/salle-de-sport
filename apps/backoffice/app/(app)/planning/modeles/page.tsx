import { CAPACITY, DURATION, zonedDateKey } from "@salle/shared";
import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { AddRow } from "@/components/inline/add-row";
import { EditableCell } from "@/components/inline/editable-cell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { createTemplateRow, generateSessions, updateTemplateField } from "./actions";

export const metadata: Metadata = { title: t("templates.title") };

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/**
 * Cours récurrents « à la Notion » : chaque cellule se modifie en place ; le changement
 * s'applique aux séances à venir qui n'ont pas été modifiées une à une.
 */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; n?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const now = currentTime();
  const today = zonedDateKey(now, context.gym.timezone);
  const in4Weeks = zonedDateKey(new Date(now.getTime() + 28 * 86_400_000), context.gym.timezone);

  const [templates, disciplines, coaches, rooms] = await Promise.all([
    supabase
      .from("class_templates")
      .select(
        "id, weekday, start_time, duration_minutes, capacity, is_active, starts_on, ends_on, discipline_id, room_id, template_coaches(coach_id, position)",
      )
      .eq("gym_id", context.gym.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("disciplines")
      .select("id, name, color")
      .eq("gym_id", context.gym.id)
      .order("position")
      .order("name"),
    supabase
      .from("coaches")
      .select("id, display_name")
      .eq("gym_id", context.gym.id)
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("rooms").select("id, name, capacity").eq("gym_id", context.gym.id).order("name"),
  ]);

  const weekdayOptions = WEEKDAYS.map((d) => ({ value: d, label: t(`weekdays.${d}`) }));
  const disciplineOptions = (disciplines.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  const coachOptions = (coaches.data ?? []).map((c) => ({ value: c.id, label: c.display_name }));
  const roomOptions = (rooms.data ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    hint: t("catalog.placesCount", { count: r.capacity }),
  }));
  const colorOf = new Map((disciplines.data ?? []).map((d) => [d.id, d.color]));
  const columns = [
    "templates.weekday",
    "templates.startTime",
    "templates.discipline",
    "templates.duration",
    "templates.capacity",
    "templates.coaches",
    "templates.room",
    "templates.startsOn",
    "templates.endsOn",
    "templates.active",
  ] as const;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("templates.title")} description={t("templates.inlineHint")} />
      <Flash ok={params.ok} error={params.erreur} />

      <div className="overflow-x-auto rounded-xl bg-card p-1 shadow-border">
        <Table className="min-w-[72rem]">
          <TableHeader>
            <TableRow>
              {columns.map((key) => (
                <TableHead key={key} className="px-3">
                  {t(key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templates.data ?? []).map((tpl) => {
              const cell = { id: tpl.id, action: updateTemplateField };
              return (
                <TableRow
                  key={tpl.id}
                  className={cn("hover:bg-transparent", !tpl.is_active && "text-muted-foreground")}
                >
                  <TableCell className="w-32 p-1">
                    <EditableCell
                      {...cell}
                      kind="select"
                      field="weekday"
                      label={t("templates.weekday")}
                      value={String(tpl.weekday)}
                      options={weekdayOptions}
                    />
                  </TableCell>
                  <TableCell className="w-28 p-1">
                    <EditableCell
                      {...cell}
                      kind="time"
                      field="start_time"
                      label={t("templates.startTime")}
                      value={tpl.start_time.slice(0, 5)}
                    />
                  </TableCell>
                  <TableCell className="w-40 p-1">
                    <span className="flex items-center gap-1">
                      <span
                        aria-hidden
                        className="ml-2 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorOf.get(tpl.discipline_id) }}
                      />
                      <EditableCell
                        {...cell}
                        kind="select"
                        field="discipline_id"
                        label={t("templates.discipline")}
                        value={tpl.discipline_id}
                        options={disciplineOptions}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="w-28 p-1">
                    <EditableCell
                      {...cell}
                      kind="number"
                      field="duration_minutes"
                      label={t("templates.duration")}
                      value={tpl.duration_minutes}
                      unit={t("catalog.minutes")}
                      min={DURATION.min}
                      max={DURATION.max}
                      step={DURATION.step}
                    />
                  </TableCell>
                  <TableCell className="w-28 p-1">
                    <EditableCell
                      {...cell}
                      kind="number"
                      field="capacity"
                      label={t("templates.capacity")}
                      value={tpl.capacity}
                      unit={t("catalog.places")}
                      min={CAPACITY.min}
                      max={CAPACITY.max}
                    />
                  </TableCell>
                  <TableCell className="min-w-48 p-1">
                    <EditableCell
                      {...cell}
                      kind="multi"
                      field="coach_ids"
                      label={t("templates.coaches")}
                      value={[...tpl.template_coaches]
                        .sort((a, b) => a.position - b.position)
                        .map((c) => c.coach_id)}
                      options={coachOptions}
                    />
                  </TableCell>
                  <TableCell className="w-36 p-1">
                    <EditableCell
                      {...cell}
                      kind="select"
                      field="room_id"
                      label={t("templates.room")}
                      value={tpl.room_id}
                      options={roomOptions}
                      clearable
                    />
                  </TableCell>
                  <TableCell className="w-36 p-1">
                    <EditableCell
                      {...cell}
                      kind="date"
                      field="starts_on"
                      label={t("templates.startsOn")}
                      value={tpl.starts_on}
                    />
                  </TableCell>
                  <TableCell className="w-36 p-1">
                    <EditableCell
                      {...cell}
                      kind="date"
                      field="ends_on"
                      label={t("templates.endsOn")}
                      value={tpl.ends_on}
                      clearable
                    />
                  </TableCell>
                  <TableCell className="w-16 p-1">
                    <EditableCell
                      {...cell}
                      kind="switch"
                      field="is_active"
                      label={t("templates.active")}
                      value={tpl.is_active}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            <AddRow
              label={t("templates.newRow")}
              action={createTemplateRow}
              colSpan={columns.length}
            />
          </TableBody>
        </Table>
      </div>

      <Card className="max-w-md">
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
  );
}
