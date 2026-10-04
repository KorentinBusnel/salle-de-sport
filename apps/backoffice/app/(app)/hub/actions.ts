"use server";

import { segmentFiltersSchema, zonedDateKey, zonedWeek } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { anthropicTurn } from "@/lib/ai/client";
import { askAssistant } from "@/lib/ai/run";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { errorMessageKey } from "@/lib/flash";
import { type MessageKey, t } from "@/lib/i18n";
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

/** Lundi de la semaine en cours (« AAAA-MM-JJ »), dans le fuseau de la salle. */
function weekStart(timezone: string) {
  const week = zonedWeek(currentTime(), timezone);
  return week.days[0]?.key ?? zonedDateKey(currentTime(), timezone);
}

/** Brief hebdomadaire : rédigé par l'assistant à la demande, enregistré pour la semaine. */
export async function generateBrief(): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const ai = anthropicTurn();
  if (!ai) return { error: "assistant.notConfigured" };
  try {
    const answer = await askAssistant({
      context,
      turn: ai.turn,
      model: ai.model,
      history: [],
      question: t("hub.briefPrompt"),
      emit: () => {},
    });
    const supabase = await createClient();
    const { error } = await supabase.from("weekly_briefs").upsert({
      gym_id: context.gym.id,
      week_start: weekStart(context.gym.timezone),
      content: answer.text,
      generated_by: context.userId,
      generated_at: new Date().toISOString(),
    });
    revalidatePath("/hub");
    refresh();
    return { error: error ? "common.unexpectedError" : null };
  } catch (error) {
    console.error("brief", error);
    return { error: "assistant.errors.failed" };
  }
}
