import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { StrategiesForm } from "@/components/settings/strategies-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { saveSettings, saveStrategies } from "./actions";

export const metadata: Metadata = { title: t("settings.title") };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const settings = await getGymSettings(context.gym.id);

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
    </div>
  );
}
