import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext, isFrontDeskRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().trim().max(40).catch("");

/**
 * Étiquettes déjà utilisées dans la salle, pour la saisie d'étiquettes (au fil de la frappe :
 * Route Handler). Lecture seule, réservée à l'accueil et plus.
 */
export async function GET(request: NextRequest) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isFrontDeskRole(result.context.role)) {
    return NextResponse.json({ tags: [] }, { status: 403 });
  }
  const query = querySchema.parse(request.nextUrl.searchParams.get("q") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tag_suggestions", {
    p_gym_id: result.context.gym.id,
    p_query: query.toLowerCase(),
    p_limit: 8,
  });
  if (error) return NextResponse.json({ tags: [] }, { status: 500 });
  return NextResponse.json({ tags: data });
}
