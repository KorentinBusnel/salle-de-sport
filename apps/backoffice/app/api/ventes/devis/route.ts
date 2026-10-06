import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bookingErrorCode } from "@salle/shared";

/** Prix d'une vente au fil de la saisie du code promo (price_quote : droits vérifiés en SQL). */
export async function GET(request: NextRequest) {
  const result = await getTeamContext();
  if (result.status !== "team") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const plan = z.guid().safeParse(request.nextUrl.searchParams.get("offre"));
  const code = z
    .string()
    .trim()
    .max(30)
    .safeParse(request.nextUrl.searchParams.get("code") ?? "");
  if (!plan.success || !code.success)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("price_quote", { p_plan_id: plan.data, ...(code.data ? { p_promo_code: code.data } : {}) })
    .single();
  if (error)
    return NextResponse.json({ error: bookingErrorCode(error) ?? "unexpected" }, { status: 422 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
