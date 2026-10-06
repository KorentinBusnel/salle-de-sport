import { z } from "zod";
import { loadConversation } from "@/lib/ai/conversations";
import { getTeamContext, isManagerRole } from "@/lib/auth";

/** Messages d'une conversation, pour changer de conversation dans le Hub sans rendu serveur. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/assistant/conversations/[id]">,
) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role))
    return Response.json({ error: "forbidden" }, { status: 403 });
  const id = z.guid().safeParse((await params).id);
  if (!id.success) return Response.json({ error: "invalid" }, { status: 400 });
  const messages = await loadConversation(result.context, id.data);
  if (!messages) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ messages }, { headers: { "cache-control": "no-store" } });
}
