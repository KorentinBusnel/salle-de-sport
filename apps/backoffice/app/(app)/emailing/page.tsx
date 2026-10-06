import { zonedDateKey, zonedMinutesOfDay } from "@salle/shared";
import type { Metadata } from "next";
import { EmailingNav } from "@/components/emailing-nav";
import { type CampaignRow, CampaignsBoard } from "@/components/emailing/campaigns-board";
import { PageHeader } from "@/components/page-header";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("emailing.title") };

/** Heure murale de la salle (« AAAA-MM-JJTHH:MM ») d'un instant : valeur du DateTimeField. */
function wallTime(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  const minutes = zonedMinutesOfDay(instant, timeZone);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${zonedDateKey(instant, timeZone)}T${hh}:${mm}`;
}

/**
 * Campagnes : tableau à lignes dépliables, création et modification en panneau latéral,
 * programmation à l'heure de la salle, envoi confirmé (« + Nouveau › Campagne » : `?nouveau=1`).
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const timeZone = context.gym.timezone;
  const format = gymFormatters(timeZone);
  const supabase = await createClient();
  const [{ data: campaigns }, { data: segments }, { data: templates }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, segment, content, scheduled_at, sent_at, stats, created_at")
      .eq("gym_id", context.gym.id)
      .eq("channel", "email")
      .order("created_at", { ascending: false }),
    supabase.from("segments").select("id, name").eq("gym_id", context.gym.id).order("name"),
    supabase
      .from("email_templates")
      .select("id, name, subject")
      .eq("gym_id", context.gym.id)
      .order("name"),
  ]);
  const segmentName = new Map((segments ?? []).map((s) => [s.id, s.name]));

  // Audience des brouillons et campagnes programmées (recalculée à l'envoi).
  const audiences = new Map(
    await Promise.all(
      (campaigns ?? [])
        .filter((c) => c.status === "draft" || c.status === "scheduled")
        .map(async (c) => {
          const segmentId = (c.segment as { segment_id?: string }).segment_id;
          if (!segmentId) return [c.id, null] as const;
          const { data } = await supabase
            .rpc("segment_audience", { p_segment_id: segmentId })
            .single();
          return [c.id, data] as const;
        }),
    ),
  );

  const rows: CampaignRow[] = (campaigns ?? []).map((c) => {
    const content = c.content as { subject?: string; body?: string };
    const stats = c.stats as { targeted?: number; excluded_no_consent?: number; queued?: number };
    const segmentId = (c.segment as { segment_id?: string }).segment_id ?? null;
    const dateLabel =
      c.status === "scheduled" && c.scheduled_at
        ? t("emailing.scheduledOn", { date: format.dateTime(c.scheduled_at) })
        : c.sent_at
          ? t("emailing.sentOn", { date: format.dateTime(c.sent_at) })
          : t("emailing.createdOn", { date: format.dateTime(c.created_at) });
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      segmentId,
      segmentName: segmentId ? (segmentName.get(segmentId) ?? null) : null,
      templateId: null,
      schedule: c.scheduled_at ? wallTime(c.scheduled_at, timeZone) : null,
      scheduledAt: c.scheduled_at,
      subject: content.subject ?? "",
      body: content.body ?? "",
      dateLabel,
      audience: audiences.get(c.id) ?? null,
      stats:
        c.status === "sent"
          ? {
              queued: stats.queued ?? 0,
              targeted: stats.targeted ?? 0,
              excluded: stats.excluded_no_consent ?? 0,
            }
          : null,
    };
  });

  return (
    <div className="grid gap-6">
      <PageHeader title={t("emailing.title")} description={t("emailing.noDelivery")} />
      <EmailingNav current="/emailing" />
      <CampaignsBoard
        campaigns={rows}
        segments={segments ?? []}
        templates={templates ?? []}
        todayKey={zonedDateKey(currentTime(), timeZone)}
        openNew={params.nouveau === "1"}
      />
    </div>
  );
}
