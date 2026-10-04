import type { Metadata } from "next";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { CatalogSection } from "@/components/settings/catalog-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { SettingsForm } from "@/components/settings/settings-form";
import { StrategiesForm } from "@/components/settings/strategies-form";
import { TeamSection } from "@/components/settings/team-section";
import { TabNav } from "@/components/tab-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { saveSettings, saveStrategies } from "./actions";

export const metadata: Metadata = { title: t("settings.title") };

/**
 * Paramètres de la salle en onglets : Général (règles de réservation), Stratégies, Catalogue
 * (disciplines, salles), Équipe (rôles) et Intégrations (services du Hub 360°).
 */
const TABS = ["general", "strategies", "catalogue", "equipe", "integrations"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const tab: Tab = TABS.find((x) => x === params.onglet) ?? "general";
  const settings =
    tab === "general" || tab === "strategies" ? await getGymSettings(context.gym.id) : null;

  return (
    <div className="grid gap-6">
      <PageHeader title={t("settings.title")} description={context.gym.name} />
      <TabNav
        label={t("settings.sections")}
        tabs={TABS.map((x) => ({
          href: x === "general" ? "/parametres" : `/parametres?onglet=${x}`,
          label: t(`settings.tab.${x}`),
          current: x === tab,
        }))}
      />
      <Flash ok={params.ok} error={params.erreur} />

      {tab === "general" && settings ? (
        <Card className="max-w-2xl">
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
      ) : null}

      {tab === "strategies" && settings ? (
        <Card className="max-w-2xl">
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
      ) : null}

      {tab === "catalogue" ? <CatalogSection gymId={context.gym.id} /> : null}
      {tab === "equipe" ? (
        <div className="max-w-2xl">
          <TeamSection context={context} />
        </div>
      ) : null}
      {tab === "integrations" ? <IntegrationsSection gymId={context.gym.id} /> : null}
    </div>
  );
}
