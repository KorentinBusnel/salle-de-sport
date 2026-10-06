import {
  BOOLEAN_SETTINGS,
  homeBlocksFor,
  LAYOUT_ROLES,
  navBadgesFor,
  SETTINGS_META,
  type SettingSection,
  zonedDateKey,
} from "@salle/shared";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { CatalogSection } from "@/components/settings/catalog-section";
import { ClosuresCard, IdentityCard, OpeningHoursCard } from "@/components/settings/gym-section";
import { DeskSlotRow, RoleLayoutCard } from "@/components/settings/home-layout";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import {
  SettingNumberRow,
  SettingRows,
  SettingSwitchRow,
} from "@/components/settings/setting-rows";
import { SettingsNav } from "@/components/settings/settings-nav";
import { TeamSection } from "@/components/settings/team-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { type GymConfig, getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("settings.title") };

/**
 * Paramètres en sections, chaque valeur enregistrée sur place avec « Annuler » : Salle
 * (identité, logo, horaires, fermetures), Réservations, Stratégies, Accueil (permanences,
 * blocs et pastilles par rôle), Suivi (seuils), Catalogue, Équipe et Intégrations.
 */
const TABS = [
  "salle",
  "reservations",
  "strategies",
  "accueil",
  "suivi",
  "catalogue",
  "equipe",
  "integrations",
] as const;
type Tab = (typeof TABS)[number];

/** Anciens liens (« ?onglet=general ») : vers la section qui les a remplacés. */
const LEGACY: Record<string, Tab> = { general: "reservations" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const requested = params.onglet ? (LEGACY[params.onglet] ?? params.onglet) : "salle";
  const tab: Tab = TABS.find((x) => x === requested) ?? "salle";
  const config = await getGymConfig(context.gym.id);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description", { gym: config.identity.name || context.gym.name })}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SettingsNav
          label={t("settings.sections")}
          sections={TABS.map((x) => ({
            href: x === "salle" ? "/parametres" : `/parametres?onglet=${x}`,
            label: t(`settings.tab.${x}`),
            hint: t(`settings.tabHint.${x}`),
            current: x === tab,
          }))}
        />
        <div className="grid max-w-3xl min-w-0 gap-6">
          {tab === "salle" ? <GymTab config={config} gymId={context.gym.id} /> : null}
          {tab === "reservations" ? (
            <NumbersCard
              config={config}
              section="reservations"
              title={t("settings.reservations.title")}
              hint={t("settings.reservations.hint")}
            />
          ) : null}
          {tab === "strategies" ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("strategies.title")}</CardTitle>
                <CardDescription>{t("settings.strategiesHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <SettingRows>
                  {SETTINGS_META.filter((meta) => meta.section === "strategies").map((meta) => (
                    <SettingNumberRow
                      key={meta.key}
                      meta={meta}
                      value={settingValue(config, meta.key)}
                    />
                  ))}
                  {BOOLEAN_SETTINGS.map((key) => (
                    <SettingSwitchRow key={key} settingKey={key} value={config.settings[key]} />
                  ))}
                </SettingRows>
              </CardContent>
            </Card>
          ) : null}
          {tab === "accueil" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.accueil.deskTitle")}</CardTitle>
                  <CardDescription>{t("settings.accueil.deskHint")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingRows>
                    {SETTINGS_META.filter((meta) => meta.section === "accueil").map((meta) => (
                      <SettingNumberRow
                        key={meta.key}
                        meta={meta}
                        value={settingValue(config, meta.key)}
                      />
                    ))}
                    <DeskSlotRow
                      start={config.private.desk_default_start}
                      end={config.private.desk_default_end}
                    />
                  </SettingRows>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.accueil.layoutTitle")}</CardTitle>
                  <CardDescription>{t("settings.accueil.layoutHint")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {LAYOUT_ROLES.map((role) => (
                    <RoleLayoutCard
                      key={role}
                      role={role}
                      blocks={homeBlocksFor(role, config.private)}
                      badges={navBadgesFor(role, config.private)}
                    />
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}
          {tab === "suivi" ? (
            <NumbersCard
              config={config}
              section="suivi"
              title={t("settings.suivi.title")}
              hint={t("settings.suivi.hint")}
            />
          ) : null}
          {tab === "catalogue" ? <CatalogSection gymId={context.gym.id} /> : null}
          {tab === "equipe" ? <TeamSection context={context} /> : null}
          {tab === "integrations" ? (
            <IntegrationsSection gymId={context.gym.id} timezone={context.gym.timezone} />
          ) : null}
        </div>
      </div>
      <p className="sr-only">{t("settings.autosave")}</p>
    </div>
  );
}

function settingValue(config: GymConfig, key: string): number | null {
  const source: Record<string, unknown> = { ...config.settings, ...config.private };
  const value = source[key];
  return typeof value === "number" ? value : null;
}

function NumbersCard({
  config,
  section,
  title,
  hint,
}: {
  config: GymConfig;
  section: SettingSection;
  title: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRows>
          {SETTINGS_META.filter((meta) => meta.section === section).map((meta) => (
            <SettingNumberRow key={meta.key} meta={meta} value={settingValue(config, meta.key)} />
          ))}
        </SettingRows>
      </CardContent>
    </Card>
  );
}

async function GymTab({ config, gymId }: { config: GymConfig; gymId: string }) {
  const supabase = await createClient();
  const todayKey = zonedDateKey(currentTime(), config.identity.timezone);
  const { data: closures } = await supabase
    .from("gym_closures")
    .select("id, day, label")
    .eq("gym_id", gymId)
    .gte("day", todayKey)
    .order("day");
  return (
    <>
      <IdentityCard
        identity={{
          name: config.identity.name,
          address: config.identity.address ?? "",
          phone: config.identity.phone ?? "",
          email: config.identity.email ?? "",
          timezone: config.identity.timezone,
          logoUrl: config.identity.logoUrl,
        }}
      />
      <OpeningHoursCard hours={config.openingHours} />
      <ClosuresCard closures={closures ?? []} todayKey={todayKey} />
    </>
  );
}
