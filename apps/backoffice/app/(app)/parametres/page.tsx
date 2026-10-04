import { parseGymSettings } from "@salle/shared";
import { Flash } from "@/components/flash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

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
    <div className="grid max-w-xl gap-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
      <Flash ok={params.ok} error={params.erreur} />
      <Card>
        <CardHeader>
          <CardTitle>{context.gym.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveSettings} className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="max_upcoming_bookings">{t("settings.maxUpcoming")}</Label>
              <Input
                id="max_upcoming_bookings"
                name="max_upcoming_bookings"
                type="number"
                min={1}
                max={50}
                defaultValue={settings.max_upcoming_bookings}
                className="w-28"
                required
              />
              <p className="text-sm text-muted-foreground">{t("settings.maxUpcomingHint")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cancellation_recommended_hours">
                {t("settings.recommendedHours")}
              </Label>
              <Input
                id="cancellation_recommended_hours"
                name="cancellation_recommended_hours"
                type="number"
                min={0}
                max={72}
                defaultValue={settings.cancellation_recommended_hours}
                className="w-28"
                required
              />
              <p className="text-sm text-muted-foreground">{t("settings.recommendedHoursHint")}</p>
            </div>
            <Button className="w-fit">{t("common.save")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
