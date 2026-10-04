import type { Metadata } from "next";
import { EmailingNav } from "@/components/emailing-nav";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { saveAutomation } from "../actions";

export const metadata: Metadata = { title: t("emailing.tab.automations") };

const KINDS = ["welcome", "inactive", "birthday"] as const;

/** Automatisations : bienvenue (à l'activation), relance des inactifs, anniversaire (quotidien). */
export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
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
      <PageHeader title={t("emailing.title")} description={t("emailing.noDelivery")} />
      <EmailingNav current="/emailing/automatisations" />
      <Flash ok={params.ok} error={params.erreur} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {KINDS.map((kind) => {
          const automation = automations?.find((a) => a.kind === kind);
          const days = (automation?.params as { days?: number } | undefined)?.days ?? 14;
          return (
            <Card key={kind}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {t(`emailing.automation.${kind}`)}
                  <StatusPill tone={automation?.enabled ? "success" : "neutral"}>
                    {automation?.enabled ? t("emailing.on") : t("emailing.off")}
                  </StatusPill>
                </CardTitle>
                <CardDescription>{t(`emailing.automationHint.${kind}`)}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveAutomation} className="grid gap-4">
                  <input type="hidden" name="kind" value={kind} />
                  <FieldGroup>
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor={`a-${kind}-on`}>{t("emailing.enabled")}</FieldLabel>
                      <Switch
                        id={`a-${kind}-on`}
                        name="enabled"
                        defaultChecked={automation?.enabled ?? false}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`a-${kind}-tpl`}>{t("emailing.template")}</FieldLabel>
                      <NativeSelect
                        id={`a-${kind}-tpl`}
                        name="template_id"
                        defaultValue={automation?.template_id ?? ""}
                      >
                        <NativeSelectOption value="">{t("emailing.noTemplate")}</NativeSelectOption>
                        {(templates ?? []).map((tpl) => (
                          <NativeSelectOption key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    {kind === "inactive" ? (
                      <Field>
                        <FieldLabel htmlFor="a-inactive-days">
                          {t("emailing.inactiveDays")}
                        </FieldLabel>
                        <Input
                          id="a-inactive-days"
                          name="days"
                          type="number"
                          min={1}
                          max={365}
                          defaultValue={days}
                          className="w-28"
                        />
                      </Field>
                    ) : null}
                  </FieldGroup>
                  <p className="text-xs text-muted-foreground">
                    {t("emailing.automationSent", {
                      count: automation ? (sentBy.get(automation.id) ?? 0) : 0,
                    })}
                    {automation?.last_run_at
                      ? ` · ${t("emailing.lastRun", { date: format.dateTime(automation.last_run_at) })}`
                      : ""}
                  </p>
                  <SubmitButton className="w-fit" variant="outline">
                    {t("common.save")}
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
