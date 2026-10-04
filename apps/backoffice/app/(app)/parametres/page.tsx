import { parseGymSettings } from "@salle/shared";
import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: t("settings.title") };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("settings")
    .eq("id", context.gym.id)
    .single();
  const settings = parseGymSettings(gym?.settings);

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
    </div>
  );
}
