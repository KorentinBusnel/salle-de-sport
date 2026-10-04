import { zonedDateKey } from "@salle/shared";
import { Flash } from "@/components/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createTemplate, generateSessions, toggleTemplate } from "./actions";

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; genere?: string }>;
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
        "id, weekday, start_time, duration_minutes, capacity, is_active, starts_on, ends_on, disciplines(name, color), coaches(display_name), rooms(name)",
      )
      .eq("gym_id", context.gym.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("disciplines")
      .select("id, name")
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

  const generated = params.genere !== undefined ? Number(params.genere) : null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{t("templates.title")}</h1>
        <p className="text-muted-foreground">{t("templates.subtitle")}</p>
      </div>

      <Flash ok={params.ok} error={params.erreur} />
      {generated !== null && Number.isFinite(generated) ? (
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
        >
          {t("templates.generated", { count: generated })}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent className="pt-2">
            {(templates.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("templates.empty")}</p>
            ) : (
              <ul className="divide-y">
                {(templates.data ?? []).map((template) => (
                  <li key={template.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{
                        backgroundColor: template.disciplines?.color ?? "var(--color-neutral-500)",
                      }}
                    />
                    <span className="min-w-48 flex-1">
                      <span className="block font-medium">
                        {template.disciplines?.name}
                        {template.coaches ? ` · ${template.coaches.display_name}` : ""}
                        {template.rooms ? ` · ${template.rooms.name}` : ""}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {t("templates.summary", {
                          weekday: t(
                            `weekdays.${String(template.weekday) as (typeof WEEKDAYS)[number]}`,
                          ),
                          time: template.start_time.slice(0, 5),
                          duration: template.duration_minutes,
                          capacity: template.capacity,
                        })}
                      </span>
                    </span>
                    <Badge variant={template.is_active ? "secondary" : "outline"}>
                      {t(template.is_active ? "templates.active" : "templates.inactive")}
                    </Badge>
                    <form action={toggleTemplate}>
                      <input type="hidden" name="id" value={template.id} />
                      <input type="hidden" name="active" value={String(!template.is_active)} />
                      <Button size="sm" variant="ghost">
                        {t(template.is_active ? "templates.deactivate" : "templates.activate")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("templates.generate")}</CardTitle>
              <CardDescription>{t("templates.generateHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={generateSessions} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="from">{t("templates.from")}</Label>
                    <Input id="from" name="from" type="date" defaultValue={today} required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="to">{t("templates.to")}</Label>
                    <Input id="to" name="to" type="date" defaultValue={in4Weeks} required />
                  </div>
                </div>
                <Button className="w-fit">{t("templates.generate")}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("templates.create")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createTemplate} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="discipline_id">{t("templates.discipline")}</Label>
                  <NativeSelect id="discipline_id" name="discipline_id" required>
                    {(disciplines.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="default_coach_id">{t("templates.coach")}</Label>
                    <NativeSelect id="default_coach_id" name="default_coach_id">
                      <option value="">{t("common.none")}</option>
                      {(coaches.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="room_id">{t("templates.room")}</Label>
                    <NativeSelect id="room_id" name="room_id">
                      <option value="">{t("common.none")}</option>
                      {(rooms.data ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="weekday">{t("templates.weekday")}</Label>
                    <NativeSelect id="weekday" name="weekday" required>
                      {WEEKDAYS.map((day) => (
                        <option key={day} value={day}>
                          {t(`weekdays.${day}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="start_time">{t("templates.startTime")}</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      defaultValue="18:30"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="duration_minutes">{t("templates.duration")}</Label>
                    <Input
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                      min={15}
                      max={240}
                      defaultValue={60}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="capacity">{t("templates.capacity")}</Label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      max={200}
                      defaultValue={16}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="starts_on">{t("templates.startsOn")}</Label>
                    <Input
                      id="starts_on"
                      name="starts_on"
                      type="date"
                      defaultValue={today}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ends_on">{t("templates.endsOn")}</Label>
                    <Input id="ends_on" name="ends_on" type="date" />
                  </div>
                </div>
                <Button className="w-fit">{t("templates.create")}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
