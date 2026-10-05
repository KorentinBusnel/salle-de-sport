"use server";

import { segmentFiltersSchema, zonedDateKey } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { generateDailyDigest } from "@/lib/ai/digest";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { errorMessageKey } from "@/lib/flash";
import { getTodayDigest } from "@/lib/digest";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Result = { error: MessageKey | null; count?: number };

const messageSchema = z.object({
  memberIds: z.array(z.guid()).min(1).max(50),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

/** Validation par le gérant d'un message proposé par l'assistant : mise en file d'envoi. */
export async function approveMessage(input: z.input<typeof messageSchema>): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_direct_message", {
    p_gym_id: context.gym.id,
    p_member_ids: parsed.data.memberIds,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
  });
  revalidatePath("/messages");
  return error ? { error: errorMessageKey(error) } : { error: null, count: data ?? 0 };
}

const segmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: segmentFiltersSchema,
});

/** Validation d'un segment proposé par l'assistant. */
export async function approveSegment(input: z.input<typeof segmentSchema>): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const parsed = segmentSchema.safeParse(input);
  if (!parsed.success) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase.from("segments").insert({
    gym_id: context.gym.id,
    name: parsed.data.name,
    filters: parsed.data.filters,
    created_by: context.userId,
  });
  revalidatePath("/segments");
  return { error: error ? "common.unexpectedError" : null };
}

/** Digest du jour : rédigé par l'assistant à la demande, enregistré pour la journée. */
export async function generateDigest(): Promise<Result> {
  const context = await requireRole(isManagerRole);
  try {
    const result = await generateDailyDigest(context);
    if ("error" in result) {
      return {
        error:
          result.error === "notConfigured" ? "assistant.notConfigured" : "assistant.errors.failed",
      };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("daily_digests").upsert({
      gym_id: context.gym.id,
      day: zonedDateKey(currentTime(), context.gym.timezone),
      content: { ...result.digest, dismissed: [] },
      generated_by: context.userId,
      generated_at: new Date().toISOString(),
    });
    revalidatePath("/");
    revalidatePath("/hub");
    refresh();
    return { error: error ? "common.unexpectedError" : null };
  } catch (error) {
    console.error("digest", error);
    return { error: "assistant.errors.failed" };
  }
}

/** « Ignorer » une action du digest du jour : elle disparaît de l'accueil et du Hub. */
export async function dismissDigestItem(itemId: string): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const id = z.string().trim().min(1).max(40).safeParse(itemId);
  if (!id.success) return { error: "common.unexpectedError" };
  const digest = await getTodayDigest(context);
  if (!digest) return { error: "common.unexpectedError" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_digests")
    .update({ content: { ...digest, dismissed: [...new Set([...digest.dismissed, id.data])] } })
    .eq("gym_id", context.gym.id)
    .eq("day", digest.day);
  revalidatePath("/");
  revalidatePath("/hub");
  refresh();
  return { error: error ? "common.unexpectedError" : null };
}
