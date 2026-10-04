"use server";

import { zonedInstant } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGNS = "/emailing";
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
  name: z.string().trim().min(1).max(120),
  segment_id: z.guid(),
  template_id: z.guid(),
});

/** Nouvelle campagne (brouillon) : le contenu du modèle est copié, il pourra évoluer seul. */
export async function createCampaign(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withFlash(CAMPAIGNS, { error: "emailing.errors.campaign" }));
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("email_templates")
    .select("id, subject, body")
    .eq("id", parsed.data.template_id)
    .single();
  if (!template) redirect(withFlash(CAMPAIGNS, { error: "emailing.errors.campaign" }));
  const { error } = await supabase.from("campaigns").insert({
    gym_id: context.gym.id,
    name: parsed.data.name,
    channel: "email",
    segment: { segment_id: parsed.data.segment_id },
    content: { template_id: template.id, subject: template.subject, body: template.body },
    created_by: context.userId,
  });
  revalidatePath(CAMPAIGNS);
  redirect(
    withFlash(
      CAMPAIGNS,
      error ? { error: "common.unexpectedError" } : { ok: "emailing.campaignCreated" },
    ),
  );
}

export async function sendCampaign(formData: FormData) {
  await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("campaignId"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_campaign", { p_campaign_id: id });
  revalidatePath(CAMPAIGNS);
  const queued = Number((data?.stats as { queued?: number } | null)?.queued ?? 0);
  redirect(
    withFlash(
      CAMPAIGNS,
      error ? { error: errorMessageKey(error) } : { ok: "emailing.campaignSent", count: queued },
    ),
  );
}

/** Programmation (date et heure locales de la salle) ou retour en brouillon. */
export async function scheduleCampaign(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("campaignId"));
  const supabase = await createClient();
  if (formData.get("unschedule") === "1") {
    await supabase
      .from("campaigns")
      .update({ status: "draft", scheduled_at: null })
      .eq("id", id)
      .eq("status", "scheduled");
    revalidatePath(CAMPAIGNS);
    redirect(withFlash(CAMPAIGNS, { ok: "emailing.campaignUnscheduled" }));
  }
  const date = z.iso.date().safeParse(formData.get("date"));
  const time = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .safeParse(formData.get("time"));
  if (!date.success || !time.success)
    redirect(withFlash(CAMPAIGNS, { error: "emailing.errors.schedule" }));
  const [h, m] = time.data.split(":").map(Number);
  const at = zonedInstant(date.data, (h ?? 0) * 60 + (m ?? 0), context.gym.timezone);
  if (at.getTime() <= Date.now())
    redirect(withFlash(CAMPAIGNS, { error: "emailing.errors.schedule" }));
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "scheduled", scheduled_at: at.toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled"]);
  revalidatePath(CAMPAIGNS);
  redirect(
    withFlash(
      CAMPAIGNS,
      error ? { error: "common.unexpectedError" } : { ok: "emailing.campaignScheduled" },
    ),
  );
}

export async function deleteCampaign(formData: FormData) {
  await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("campaignId"));
  const supabase = await createClient();
  await supabase.from("campaigns").delete().eq("id", id).in("status", ["draft", "scheduled"]);
  revalidatePath(CAMPAIGNS);
  redirect(withFlash(CAMPAIGNS, { ok: "emailing.campaignDeleted" }));
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
