import "server-only";
import type { ChatMessage } from "@/components/assistant/use-assistant";
import type { TeamContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Messages d'une conversation du gérant connecté (la RLS limite déjà aux siennes ; la salle et
 * l'auteur sont revérifiés). Les propositions passées ne sont pas reproposées à la validation.
 */
export async function loadConversation(
  context: TeamContext,
  conversationId: string,
): Promise<ChatMessage[] | null> {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("gym_id", context.gym.id)
    .eq("profile_id", context.userId)
    .maybeSingle();
  if (!conversation) return null;
  const { data } = await supabase
    .from("ai_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at");
  return (data ?? []).map((m) => {
    const content = m.content as { text?: string; steps?: string[]; stopped?: boolean };
    return {
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      text: content.text ?? "",
      steps: content.steps ?? [],
      proposals: [],
      ...(content.stopped ? { stopped: true } : {}),
    };
  });
}
