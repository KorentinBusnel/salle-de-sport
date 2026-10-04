import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { StrategiesForm } from "@/components/settings/strategies-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { XIcon } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { addTeamRole, removeTeamRole, saveSettings, saveStrategies } from "./actions";

export const metadata: Metadata = { title: t("settings.title") };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const settings = await getGymSettings(context.gym.id);
  const supabase = await createClient();
  const { data: team } = await supabase.rpc("team_members", { p_gym_id: context.gym.id });
  const isAdmin = context.role === "admin";
  const assignable: ("staff" | "coach" | "manager" | "admin")[] = isAdmin
    ? ["staff", "coach", "manager", "admin"]
    : ["staff", "coach", "manager"];

  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title={t("settings.title")} description={context.gym.name} />
      <Flash ok={params.ok} error={params.erreur} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.bookingRules")}</CardTitle>
          <CardDescription>{t("settings.bookingRulesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            action={saveSettings}
            initial={{
              max_upcoming_bookings: String(settings.max_upcoming_bookings),
              cancellation_recommended_hours: String(settings.cancellation_recommended_hours),
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("strategies.title")}</CardTitle>
          <CardDescription>{t("strategies.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <StrategiesForm
            action={saveStrategies}
            initial={{
              late_booking_minutes: String(settings.late_booking_minutes),
              attendance_opens_minutes_before:
                settings.attendance_opens_minutes_before === null
                  ? ""
                  : String(settings.attendance_opens_minutes_before),
              allow_attendance_reset: settings.allow_attendance_reset,
              manager_can_remove_credits: settings.manager_can_remove_credits,
              staff_can_suspend_members: settings.staff_can_suspend_members,
              staff_can_create_members: settings.staff_can_create_members,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("team.title")}</CardTitle>
          <CardDescription>{t("team.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <ul className="divide-y rounded-lg border">
            {(team ?? []).map((member) => (
              <li key={member.profile_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="grid min-w-0 flex-1 text-sm">
                  <span className="truncate font-medium">
                    {[member.first_name, member.last_name].filter(Boolean).join(" ") ||
                      member.email}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {member.roles.map((role) => {
                    const locked =
                      (member.profile_id === context.userId &&
                        (role === "manager" || role === "admin")) ||
                      (role === "admin" && !isAdmin);
                    return (
                      <span
                        key={role}
                        className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs"
                      >
                        {t(`roles.${role}`)}
                        {locked ? (
                          <span className="w-1" />
                        ) : (
                          <form action={removeTeamRole}>
                            <input type="hidden" name="profileId" value={member.profile_id} />
                            <input type="hidden" name="role" value={role} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("team.remove", { role: t(`roles.${role}`) })}
                            >
                              <XIcon />
                            </Button>
                          </form>
                        )}
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <form action={addTeamRole} className="flex flex-wrap items-end gap-2">
            <label className="grid flex-1 gap-1 text-sm">
              <span className="text-muted-foreground">{t("team.email")}</span>
              <Input name="email" type="email" required placeholder="prenom@exemple.fr" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("team.role")}</span>
              <NativeSelect name="role" defaultValue="staff">
                {assignable.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {t(`roles.${role}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <SubmitButton variant="outline">{t("team.add")}</SubmitButton>
          </form>
          <p className="text-xs text-muted-foreground">{t("team.inviteLater")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
