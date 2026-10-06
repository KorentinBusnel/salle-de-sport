import type { Json } from "@salle/supabase";
import { z } from "zod";
import type { AgentMessage } from "@/lib/ai/agent";
import { anthropicTurn } from "@/lib/ai/client";
import { askAssistant } from "@/lib/ai/run";
import type { AssistantEvent } from "@/lib/ai/types";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.guid().optional(),
  memberId: z.guid().optional(),
});

/**
 * Assistant du Hub 360° (gérant) : réponse en flux NDJSON (texte, étapes, propositions).
 * La conversation est enregistrée ; l'appel est journalisé sans son contenu.
 */
export async function POST(request: Request) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role))
    return Response.json({ error: "forbidden" }, { status: 403 });
  const context = result.context;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const ai = anthropicTurn();
  if (!ai) return Response.json({ error: "not_configured" }, { status: 503 });

  const supabase = await createClient();
  let conversationId = parsed.data.conversationId;
  let history: AgentMessage[] = [];
  if (conversationId) {
    const { data } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);
    history = (data ?? []).reverse().flatMap((m): AgentMessage[] => {
      const text = String((m.content as { text?: unknown }).text ?? "");
      if (!text) return [];
      return m.role === "user"
        ? [{ role: "user", content: text }]
        : [{ role: "assistant", content: [{ type: "text", text }] }];
    });
  } else {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        gym_id: context.gym.id,
        profile_id: context.userId,
        title: parsed.data.message.slice(0, 120),
      })
      .select("id")
      .single();
    if (error || !data) return Response.json({ error: "unexpected" }, { status: 500 });
    conversationId = data.id;
  }
  await supabase.from("ai_messages").insert({
    gym_id: context.gym.id,
    conversation_id: conversationId,
    role: "user",
    content: { text: parsed.data.message },
  });

  // « Arrêter » côté navigateur : la requête est abandonnée, le flux annulé, le modèle interrompu.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    cancel() {
      abort.abort();
    },
    async start(controller) {
      const emit = (event: AssistantEvent) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          abort.abort();
        }
      };
      emit({ type: "conversation", id: conversationId });
      try {
        const answer = await askAssistant({
          context,
          turn: ai.turn,
          model: ai.model,
          history,
          question: parsed.data.message,
          memberId: parsed.data.memberId,
          conversationId,
          emit,
          signal: abort.signal,
        });
        await supabase.from("ai_messages").insert({
          gym_id: context.gym.id,
          conversation_id: conversationId,
          role: "assistant",
          content: JSON.parse(
            JSON.stringify({
              text: answer.text,
              steps: answer.steps,
              proposals: answer.proposals,
              ...(answer.stopped ? { stopped: true } : {}),
            }),
          ) as { [key: string]: Json },
        });
        await supabase
          .from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        emit({ type: "done" });
      } catch (error) {
        console.error("assistant", error);
        emit({ type: "error", message: "assistant.errors.failed" });
      } finally {
        try {
          controller.close();
        } catch {
          // Flux déjà annulé par le navigateur.
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
