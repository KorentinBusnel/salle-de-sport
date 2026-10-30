"use client";

import { useId } from "react";
import { type AutomationInput, saveAutomation } from "@/app/(app)/emailing/actions";
import { useAutosave } from "@/components/settings/setting-rows";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

/**
 * Automatisation enregistrée sur place, comme les réglages des Paramètres : interrupteur et
 * modèle à chaque changement, délai à la sortie du champ, toast « Annuler » (useAutosave).
 */
export function AutomationCard({
  initial,
  templates,
  footer,
}: {
  initial: AutomationInput;
  templates: { id: string; name: string }[];
  /** Messages envoyés et dernier passage, calculés côté serveur. */
  footer: string;
}) {
  const id = useId();
  const { value, commit, pending } = useAutosave(
    initial,
    saveAutomation,
    `automation-${initial.kind}`,
  );
  const kind = value.kind;
  return (
    <Card aria-busy={pending}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {t(`emailing.automation.${kind}`)}
          <StatusPill tone={value.enabled ? "success" : "neutral"}>
            {value.enabled ? t("emailing.on") : t("emailing.off")}
          </StatusPill>
        </CardTitle>
        <CardDescription>{t(`emailing.automationHint.${kind}`)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel htmlFor={`${id}-on`}>{t("emailing.enabled")}</FieldLabel>
            <Switch
              id={`${id}-on`}
              checked={value.enabled}
              onCheckedChange={(enabled) =>
                commit(
                  { ...value, enabled },
                  t(enabled ? "emailing.automationOn" : "emailing.automationOff"),
                )
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-tpl`}>{t("emailing.template")}</FieldLabel>
            <NativeSelect
              id={`${id}-tpl`}
              value={value.template_id}
              onChange={(event) =>
                commit({ ...value, template_id: event.target.value }, t("common.saved"))
              }
            >
              <NativeSelectOption value="">{t("emailing.noTemplate")}</NativeSelectOption>
              {templates.map((tpl) => (
                <NativeSelectOption key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {kind === "inactive" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-days`}>{t("emailing.inactiveDays")}</FieldLabel>
              <Input
                id={`${id}-days`}
                type="number"
                min={1}
                max={365}
                defaultValue={value.days}
                key={value.days}
                onBlur={(event) => {
                  const days = Number(event.target.value);
                  if (Number.isInteger(days) && days >= 1 && days <= 365)
                    commit({ ...value, days }, t("common.saved"));
                }}
                className="w-28"
              />
            </Field>
          ) : null}
        </FieldGroup>
        <p className="text-xs text-muted-foreground">{footer}</p>
      </CardContent>
    </Card>
  );
}
