import { z } from "zod";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Audience d'un segment (ciblés, joignables par email) : panneau de campagne. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/segments/[id]/audience">,
) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role))
    return Response.json({ error: "forbidden" }, { status: 403 });
  const id = z.guid().safeParse((await params).id);
  if (!id.success) return Response.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("segment_audience", { p_segment_id: id.data })
    .single();
  if (error || !data) return Response.json({ error: "unexpected" }, { status: 500 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
