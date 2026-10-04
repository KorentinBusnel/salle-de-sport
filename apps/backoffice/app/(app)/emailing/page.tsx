import { zonedDateKey } from "@salle/shared";
import { SendIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmailingNav } from "@/components/emailing-nav";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { createCampaign, deleteCampaign, scheduleCampaign, sendCampaign } from "./actions";

export const metadata: Metadata = { title: t("emailing.title") };

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "brand",
  sending: "warning",
  sent: "success",
  cancelled: "danger",
} as const;

/** Campagnes : brouillon (segment + modèle), audience joignable, envoi ou programmation. */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const supabase = await createClient();
  const [{ data: campaigns }, { data: segments }, { data: templates }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, segment, content, scheduled_at, sent_at, stats, created_at")
      .eq("gym_id", context.gym.id)
      .eq("channel", "email")
      .order("created_at", { ascending: false }),
    supabase.from("segments").select("id, name").eq("gym_id", context.gym.id).order("name"),
    supabase.from("email_templates").select("id, name").eq("gym_id", context.gym.id).order("name"),
  ]);
  const segmentName = new Map((segments ?? []).map((s) => [s.id, s.name]));

  // Audience des brouillons et campagnes programmées (évaluée à l'envoi).
  const pending = (campaigns ?? []).filter((c) => c.status === "draft" || c.status === "scheduled");
  const audiences = new Map(
    await Promise.all(
      pending.map(async (c) => {
        const segmentId = (c.segment as { segment_id?: string }).segment_id ?? "";
        const { data } = await supabase
          .rpc("segment_audience", { p_segment_id: segmentId })
          .single();
        return [c.id, data] as const;
      }),
    ),
  );
  const tomorrow = zonedDateKey(
    new Date(currentTime().getTime() + 86_400_000),
    context.gym.timezone,
  );

  return (
    <div className="grid gap-6">
      <PageHeader title={t("emailing.title")} description={t("emailing.noDelivery")} />
      <EmailingNav current="/emailing" />
      <Flash ok={params.ok} error={params.erreur} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-3">
          {!campaigns?.length ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t("emailing.noCampaign")}
            </p>
          ) : null}
          {(campaigns ?? []).map((c) => {
            const content = c.content as { subject?: string };
            const stats = c.stats as {
              targeted?: number;
              excluded_no_consent?: number;
              queued?: number;
            };
            const segmentId = (c.segment as { segment_id?: string }).segment_id;
            const audience = audiences.get(c.id);
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <CardTitle>{c.name}</CardTitle>
                    <CardDescription>
                      {content.subject} ·{" "}
                      {segmentId ? (
                        <Link href={`/segments?segment=${segmentId}`} className="underline">
                          {segmentName.get(segmentId) ?? t("emailing.deletedSegment")}
                        </Link>
                      ) : null}
                    </CardDescription>
                  </div>
                  <StatusPill tone={STATUS_TONE[c.status]}>
                    {t(`emailing.status.${c.status}`)}
                  </StatusPill>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  {c.status === "sent" ? (
                    <p className="text-muted-foreground">
                      {t("emailing.sentStats", {
                        date: format.dateTime(c.sent_at ?? c.created_at),
                        queued: stats.queued ?? 0,
                        targeted: stats.targeted ?? 0,
                        excluded: stats.excluded_no_consent ?? 0,
                      })}
                    </p>
                  ) : null}
                  {c.status === "cancelled" ? (
                    <p className="text-destructive">{t("emailing.cancelledHint")}</p>
                  ) : null}
                  {audience ? (
                    <p>
                      {t("emailing.audience", {
                        reachable: audience.reachable,
                        targeted: audience.targeted,
                      })}
                    </p>
                  ) : null}
                  {c.status === "scheduled" && c.scheduled_at ? (
                    <p className="text-muted-foreground">
                      {t("emailing.scheduledFor", { date: format.dateTime(c.scheduled_at) })}
                    </p>
                  ) : null}
                  {c.status === "draft" || c.status === "scheduled" ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <ConfirmDialog
                        trigger={
                          <Button size="sm">
                            <SendIcon data-icon="inline-start" />
                            {t("emailing.sendNow")}
                          </Button>
                        }
                        title={t("emailing.sendTitle", { name: c.name })}
                        description={t("emailing.sendBody", {
                          count: audience?.reachable ?? 0,
                        })}
                        confirmLabel={t("emailing.sendNow")}
                        action={sendCampaign}
                        fields={{ campaignId: c.id }}
                      />
                      <form action={scheduleCampaign} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="campaignId" value={c.id} />
                        <Input
                          type="date"
                          name="date"
                          required
                          defaultValue={tomorrow}
                          aria-label={t("emailing.date")}
                          className="w-40"
                        />
                        <Input
                          type="time"
                          name="time"
                          required
                          defaultValue="10:00"
                          aria-label={t("emailing.time")}
                          className="w-28"
                        />
                        <SubmitButton size="sm" variant="outline">
                          {t("emailing.schedule")}
                        </SubmitButton>
                      </form>
                      {c.status === "scheduled" ? (
                        <form action={scheduleCampaign}>
                          <input type="hidden" name="campaignId" value={c.id} />
                          <input type="hidden" name="unschedule" value="1" />
                          <SubmitButton size="sm" variant="ghost">
                            {t("emailing.unschedule")}
                          </SubmitButton>
                        </form>
                      ) : null}
                      <form action={deleteCampaign} className="ml-auto">
                        <input type="hidden" name="campaignId" value={c.id} />
                        <Button
                          type="submit"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("emailing.deleteCampaign")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("emailing.newCampaign")}</CardTitle>
            <CardDescription>{t("emailing.newCampaignHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {segments?.length && templates?.length ? (
              <form action={createCampaign} className="grid gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="c-name">{t("emailing.campaignName")}</FieldLabel>
                    <Input id="c-name" name="name" required maxLength={120} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-segment">{t("emailing.segment")}</FieldLabel>
                    <NativeSelect id="c-segment" name="segment_id" required>
                      {segments.map((s) => (
                        <NativeSelectOption key={s.id} value={s.id}>
                          {s.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-template">{t("emailing.template")}</FieldLabel>
                    <NativeSelect id="c-template" name="template_id" required>
                      {templates.map((tpl) => (
                        <NativeSelectOption key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </FieldGroup>
                <SubmitButton className="w-fit">{t("emailing.createDraft")}</SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("emailing.needSegmentAndTemplate")}{" "}
                <Link href="/segments" className="underline">
                  {t("nav.segments")}
                </Link>{" "}
                ·{" "}
                <Link href="/emailing/modeles" className="underline">
                  {t("emailing.tab.templates")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
