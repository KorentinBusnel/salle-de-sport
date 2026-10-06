"use server";

import { zonedInstant } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { errorMessageKey, withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const TEMPLATES = "/emailing/modeles";
const AUTOMATIONS = "/emailing/automatisations";

const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

export async function saveTemplate(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z
    .guid()
    .optional()
    .catch(undefined)
    .parse(formData.get("templateId") || undefined);
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  const back = id ? `${TEMPLATES}?modele=${id}` : TEMPLATES;
  if (!parsed.success) redirect(withFlash(back, { error: "emailing.errors.template" }));
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("email_templates")
        .update(parsed.data)
        .eq("id", id)
        .eq("gym_id", context.gym.id)
        .select("id")
        .single()
    : await supabase
        .from("email_templates")
        .insert({ ...parsed.data, gym_id: context.gym.id, created_by: context.userId })
        .select("id")
        .single();
  revalidatePath(TEMPLATES);
  if (error || !data) redirect(withFlash(back, { error: "common.unexpectedError" }));
  redirect(withFlash(`${TEMPLATES}?modele=${data.id}`, { ok: "emailing.templateSaved" }));
}

export async function deleteTemplate(formData: FormData) {
  await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("templateId"));
  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").delete().eq("id", id);
  revalidatePath(TEMPLATES);
  // Un modèle utilisé par une automatisation ne se supprime pas (clé étrangère).
  redirect(
    withFlash(
      TEMPLATES,
      error ? { error: "emailing.errors.templateInUse" } : { ok: "emailing.templateDeleted" },
    ),
  );
}

const campaignSchema = z.object({
  id: z.guid().optional(),
  name: z.string().trim().min(1).max(120),
  segmentId: z.guid(),
  /** Nouveau modèle : son contenu est (re)copié dans la campagne. Absent : contenu gardé. */
  templateId: z.guid().nullable().optional(),
  /** Date et heure murales de la salle (« AAAA-MM-JJTHH:MM ») ; null : brouillon. */
  schedule: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});

/**
 * Création ou modification d'une campagne (brouillon ou programmée) depuis le panneau latéral.
 * Le contenu du modèle est copié : la campagne n'évolue plus avec lui.
 */
export async function saveCampaign(input: z.input<typeof campaignSchema>): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return fail("emailing.errors.campaign");
  const { id, name, segmentId, templateId, schedule } = parsed.data;
  if (!id && !templateId) return fail("emailing.errors.campaign");

  let scheduledAt: string | null = null;
  if (schedule) {
    const [day = "", time = ""] = schedule.split("T");
    const [h, m] = time.split(":").map(Number);
    const at = zonedInstant(day, (h ?? 0) * 60 + (m ?? 0), context.gym.timezone);
    if (at.getTime() <= currentTime().getTime()) return fail("emailing.errors.schedule");
    scheduledAt = at.toISOString();
  }

  const supabase = await createClient();
  let content: { template_id: string; subject: string; body: string } | undefined;
  if (templateId) {
    const { data: template } = await supabase
      .from("email_templates")
      .select("id, subject, body")
      .eq("id", templateId)
      .eq("gym_id", context.gym.id)
      .maybeSingle();
    if (!template) return fail("emailing.errors.campaign");
    content = { template_id: template.id, subject: template.subject, body: template.body };
  }

  const fields = {
    name,
    segment: { segment_id: segmentId },
    status: scheduledAt ? ("scheduled" as const) : ("draft" as const),
    scheduled_at: scheduledAt,
    ...(content ? { content } : {}),
  };
  const { error } = id
    ? await supabase
        .from("campaigns")
        .update(fields)
        .eq("id", id)
        .eq("gym_id", context.gym.id)
        .in("status", ["draft", "scheduled"])
    : await supabase.from("campaigns").insert({
        ...fields,
        content: content ?? {},
        gym_id: context.gym.id,
        channel: "email",
        created_by: context.userId,
      });
  if (error) return fail("common.unexpectedError");
  refresh();
  return ok(
    scheduledAt
      ? "emailing.campaignScheduled"
      : id
        ? "emailing.campaignSaved"
        : "emailing.campaignCreated",
  );
}

/** Envoi immédiat, après confirmation (« Je comprends ») : audience recalculée en SQL. */
export async function sendCampaignNow(id: string): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const campaignId = z.guid().safeParse(id);
  if (!campaignId.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_campaign", { p_campaign_id: campaignId.data });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok(
    "emailing.campaignSent",
    Number((data?.stats as { queued?: number } | null)?.queued ?? 0),
  );
}

/** Retour en brouillon d'une campagne programmée (« Annuler » la reprogramme). */
export async function setCampaignSchedule(
  id: string,
  scheduledAt: string | null,
): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const campaignId = z.guid().safeParse(id);
  const at = z.iso.datetime({ offset: true }).nullable().safeParse(scheduledAt);
  if (!campaignId.success || !at.success) return fail("common.unexpectedError");
  if (at.data && new Date(at.data).getTime() <= currentTime().getTime())
    return fail("emailing.errors.schedule");
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update(
      at.data
        ? { status: "scheduled", scheduled_at: at.data }
        : { status: "draft", scheduled_at: null },
    )
    .eq("id", campaignId.data)
    .eq("gym_id", context.gym.id)
    .in("status", ["draft", "scheduled"]);
  if (error) return fail("common.unexpectedError");
  refresh();
  return ok(at.data ? "emailing.campaignScheduled" : "emailing.campaignUnscheduled");
}

/** Suppression d'un brouillon ou d'une campagne programmée (après confirmation). */
export async function deleteCampaignQuick(id: string): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const campaignId = z.guid().safeParse(id);
  if (!campaignId.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId.data)
    .eq("gym_id", context.gym.id)
    .in("status", ["draft", "scheduled"]);
  if (error) return fail("common.unexpectedError");
  refresh();
  return ok("emailing.campaignDeleted");
}

const automationSchema = z.object({
  kind: z.enum(["welcome", "inactive", "birthday"]),
  template_id: z.union([z.literal(""), z.guid()]),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function saveAutomation(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const parsed = automationSchema.safeParse({
    kind: formData.get("kind"),
    template_id: formData.get("template_id") ?? "",
    days: formData.get("days") || undefined,
  });
  if (!parsed.success) redirect(withFlash(AUTOMATIONS, { error: "emailing.errors.automation" }));
  const enabled = formData.get("enabled") === "on";
  if (enabled && !parsed.data.template_id)
    redirect(withFlash(AUTOMATIONS, { error: "emailing.errors.automationTemplate" }));
  const supabase = await createClient();
  const { error } = await supabase.from("automations").upsert(
    {
      gym_id: context.gym.id,
      kind: parsed.data.kind,
      enabled,
      template_id: parsed.data.template_id || null,
      params: parsed.data.kind === "inactive" ? { days: parsed.data.days ?? 14 } : {},
    },
    { onConflict: "gym_id,kind" },
  );
  revalidatePath(AUTOMATIONS);
  redirect(
    withFlash(AUTOMATIONS, error ? { error: "common.unexpectedError" } : { ok: "common.saved" }),
  );
}
