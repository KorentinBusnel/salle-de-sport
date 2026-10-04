import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext, isFrontDeskRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().trim().min(2).max(80);

/**
 * Recherche d'adhérents au fil de la frappe (combobox de la fiche séance). Lecture seule :
 * Route Handler plutôt que Server Action (traitées une par une). La RLS reste la barrière.
 */
export async function GET(request: NextRequest) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isFrontDeskRole(result.context.role)) {
    return NextResponse.json({ members: [] }, { status: 403 });
  }
  const parsed = querySchema.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ members: [] });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_members", {
    p_gym_id: result.context.gym.id,
    p_query: parsed.data,
    p_limit: 8,
  });
  if (error) return NextResponse.json({ members: [] }, { status: 500 });
  return NextResponse.json({
    members: data.map(({ id, first_name, last_name, email, phone, status }) => ({
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
    })),
  });
}
