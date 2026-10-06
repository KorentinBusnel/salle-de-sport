"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCampaign } from "@/app/(app)/emailing/actions";
import { Combobox } from "@/components/forms/combobox";
import { DateTimeField } from "@/components/forms/date-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

export type CampaignDraft = {
  id: string;
  name: string;
  segmentId: string | null;
  templateId: string | null;
  /** Programmation en heure murale de la salle (« AAAA-MM-JJTHH:MM »). */
  schedule: string | null;
};

type Audience = { targeted: number; reachable: number };

/**
 * Création et modification d'une campagne dans un panneau latéral : nom, segment (audience
 * joignable affichée), modèle (contenu copié), programmation facultative (vide : brouillon).
 */
export function CampaignSheet({
  open,
  onOpenChange,
  campaign,
  segments,
  templates,
  todayKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDraft | null;
  segments: { id: string; name: string }[];
  templates: { id: string; name: string; subject: string }[];
  todayKey: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        {open ? (
          <CampaignForm
            key={campaign?.id ?? "new"}
            campaign={campaign}
            segments={segments}
            templates={templates}
            todayKey={todayKey}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CampaignForm({
  campaign,
  segments,
  templates,
  todayKey,
  onDone,
}: {
  campaign: CampaignDraft | null;
  segments: { id: string; name: string }[];
  templates: { id: string; name: string; subject: string }[];
  todayKey: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name ?? "");
  const [segmentId, setSegmentId] = useState<string | null>(
    campaign?.segmentId ?? segments[0]?.id ?? null,
  );
  // En modification, le contenu actuel est gardé tant qu'aucun autre modèle n'est choisi.
  const [templateId, setTemplateId] = useState<string | null>(
    campaign ? null : (templates[0]?.id ?? null),
  );
  const [schedule, setSchedule] = useState<string | null>(campaign?.schedule ?? null);
  const [audience, setAudience] = useState<{ id: string; value: Audience | null } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!segmentId) return;
    const controller = new AbortController();
    fetch(`/api/segments/${segmentId}/audience`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<Audience>) : null))
      .then((value) => setAudience({ id: segmentId, value }))
      .catch(() => {});
    return () => controller.abort();
  }, [segmentId]);

  const nameMissing = submitted && !name.trim();
  const segmentMissing = submitted && !segmentId;
  const templateMissing = submitted && !campaign && !templateId;
  const loadingAudience = segmentId !== null && audience?.id !== segmentId;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !segmentId || (!campaign && !templateId)) return;
    startTransition(async () => {
      const result = await saveCampaign({
        ...(campaign ? { id: campaign.id } : {}),
        name,
        segmentId,
        templateId,
        schedule,
      });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      if (result.message) toast.success(t(result.message));
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex h-full min-h-0 flex-col">
      <SheetHeader>
        <SheetTitle>{t(campaign ? "emailing.editCampaign" : "emailing.newCampaign")}</SheetTitle>
        <SheetDescription>{t("emailing.newCampaignHint")}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <FieldGroup>
          <Field data-invalid={nameMissing || undefined}>
            <FieldLabel htmlFor="campaign-name">{t("emailing.campaignName")}</FieldLabel>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              aria-invalid={nameMissing || undefined}
              autoFocus
            />
          </Field>
          <Field data-invalid={segmentMissing || undefined}>
            <FieldLabel htmlFor="campaign-segment">{t("emailing.segment")}</FieldLabel>
            <Combobox
              id="campaign-segment"
              options={segments.map((s) => ({ value: s.id, label: s.name }))}
              value={segmentId}
              onChange={setSegmentId}
              placeholder={t("emailing.chooseSegment")}
              invalid={segmentMissing}
            />
            <FieldDescription aria-live="polite" className="flex items-center gap-1.5">
              {loadingAudience ? <Spinner /> : null}
              {audience?.value && !loadingAudience
                ? t("emailing.audience", {
                    reachable: audience.value.reachable,
                    targeted: audience.value.targeted,
                  })
                : null}
            </FieldDescription>
          </Field>
          <Field data-invalid={templateMissing || undefined}>
            <FieldLabel htmlFor="campaign-template">{t("emailing.template")}</FieldLabel>
            <Combobox
              id="campaign-template"
              options={templates.map((tpl) => ({
                value: tpl.id,
                label: tpl.name,
                description: tpl.subject,
              }))}
              value={templateId}
              onChange={setTemplateId}
              placeholder={t(campaign ? "emailing.keepContent" : "emailing.chooseTemplate")}
              clearable={Boolean(campaign)}
              invalid={templateMissing}
            />
            {campaign ? (
              <FieldDescription>{t("emailing.templateReplaces")}</FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="campaign-schedule">{t("emailing.scheduleField")}</FieldLabel>
            <DateTimeField
              id="campaign-schedule"
              value={schedule}
              onChange={setSchedule}
              min={todayKey}
              clearable
            />
            <FieldDescription>{t("emailing.scheduleHint")}</FieldDescription>
          </Field>
        </FieldGroup>
      </SheetBody>
      <SheetFooter>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t(
            schedule ? "emailing.saveScheduled" : campaign ? "common.save" : "emailing.createDraft",
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </SheetFooter>
    </form>
  );
}
