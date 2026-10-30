import type { Metadata } from "next";
import { AutomationCard } from "@/components/emailing/automation-card";
import { EmailingNav } from "@/components/emailing-nav";
import { PageHeader } from "@/components/page-header";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("emailing.tab.automations") };

const KINDS = ["welcome", "inactive", "birthday"] as const;

/**
 * Automatisations : bienvenue (à l'activation), relance des inactifs, anniversaire (quotidien),
 * enregistrées sur place (AutomationCard).
 */
export default async function AutomationsPage() {
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const supabase = await createClient();
  const [{ data: automations }, { data: templates }, { data: sent }] = await Promise.all([
    supabase
      .from("automations")
      .select("id, kind, enabled, template_id, params, last_run_at")
      .eq("gym_id", context.gym.id),
    supabase.from("email_templates").select("id, name").eq("gym_id", context.gym.id).order("name"),
    supabase
      .from("outbound_messages")
      .select("ref_id")
      .eq("gym_id", context.gym.id)
      .eq("origin", "automation"),
  ]);
  const sentBy = new Map<string, number>();
  for (const m of sent ?? []) if (m.ref_id) sentBy.set(m.ref_id, (sentBy.get(m.ref_id) ?? 0) + 1);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("emailing.tab.automations")}
        description={t("emailing.automationsHint")}
      />
      <EmailingNav current="/emailing/automatisations" />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {KINDS.map((kind) => {
          const automation = automations?.find((a) => a.kind === kind);
          const days = (automation?.params as { days?: number } | undefined)?.days ?? 14;
          const sentCount = automation ? (sentBy.get(automation.id) ?? 0) : 0;
          const footer = `${t("emailing.automationSent", { count: sentCount })}${
            automation?.last_run_at
              ? ` · ${t("emailing.lastRun", { date: format.dateTime(automation.last_run_at) })}`
              : ""
          }`;
          return (
            <AutomationCard
              key={kind}
              initial={{
                kind,
                enabled: automation?.enabled ?? false,
                template_id: automation?.template_id ?? "",
                days,
              }}
              templates={templates ?? []}
              footer={footer}
            />
          );
        })}
      </div>
    </div>
  );
}
