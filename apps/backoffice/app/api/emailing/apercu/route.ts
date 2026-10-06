import { z } from "zod";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  subject: z.string().max(200),
  body: z.string().max(10000),
  memberId: z.guid().nullable().optional(),
});

/**
 * Aperçu d'un modèle au fil de la frappe, pour un adhérent choisi (le premier actif à défaut) :
 * variables rendues en SQL (private.render_template), comme à l'envoi.
 */
export async function POST(request: Request) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role))
    return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("preview_template", {
      p_gym_id: result.context.gym.id,
      p_subject: parsed.data.subject,
      p_body: parsed.data.body,
      ...(parsed.data.memberId ? { p_member_id: parsed.data.memberId } : {}),
    })
    .single();
  if (error || !data) return Response.json({ error: "unexpected" }, { status: 500 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
