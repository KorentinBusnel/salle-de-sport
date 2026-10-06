import "server-only";
import { zonedDateKey } from "@salle/shared";
import { type AgentMessage, type AgentTool, runAgent, type Turn } from "@/lib/ai/agent";
import { assistantTools, systemPrompt, type ToolContext } from "@/lib/ai/tools";
import type { AssistantEvent, Proposal } from "@/lib/ai/types";
import type { TeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

/** Pose une question à l'assistant pour le gérant connecté (outils sous sa RLS). */
export async function askAssistant({
  context,
  turn,
  model,
  history,
  question,
  memberId,
  conversationId,
  tools = assistantTools,
  instructions,
  emit,
  signal,
}: {
  context: TeamContext;
  turn: Turn;
  model: string;
  history: AgentMessage[];
  question: string;
  memberId?: string | undefined;
  conversationId?: string | undefined;
  /** Outils disponibles (par défaut ceux de l'assistant). */
  tools?: AgentTool<ToolContext>[] | undefined;
  /** Consignes ajoutées à la consigne système (génération du digest…). */
  instructions?: string | undefined;
  emit: (event: AssistantEvent) => void;
  /** « Arrêter » : interrompt la réponse en cours (le texte reçu est gardé). */
  signal?: AbortSignal | undefined;
}) {
  const supabase = await createClient();
  const today = zonedDateKey(currentTime(), context.gym.timezone);
  let memberContext: string | undefined;
  if (memberId) {
    const { data } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("id", memberId)
      .eq("gym_id", context.gym.id)
      .maybeSingle();
    if (data)
      memberContext = `Le gérant consulte la fiche de ${data.first_name} ${data.last_name} (id ${data.id}) : commence par get_member_timeline.`;
  }
  const ctx: ToolContext = {
    supabase,
    gymId: context.gym.id,
    timezone: context.gym.timezone,
    today,
  };
  const result = await runAgent({
    turn,
    system: systemPrompt(
      context.gym.name,
      today,
      context.gym.timezone,
      [memberContext, instructions].filter(Boolean).join("\n") || undefined,
    ),
    history: [...history, { role: "user", content: question }],
    tools,
    ctx,
    onText: (delta) => emit({ type: "text", delta }),
    onStep: (label) => emit({ type: "step", label }),
    onProposal: (proposal: Proposal) => emit({ type: "proposal", proposal }),
    signal,
  });
  await supabase.rpc("log_ai_call", {
    p_gym_id: context.gym.id,
    ...(conversationId ? { p_conversation_id: conversationId } : {}),
    p_tools: result.toolsUsed,
    p_input_tokens: result.usage.input,
    p_output_tokens: result.usage.output,
    p_model: model,
  });
  return result;
}
