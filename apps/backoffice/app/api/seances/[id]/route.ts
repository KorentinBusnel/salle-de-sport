import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Inscrits d'une séance pour l'aperçu du planning (SessionSheet), chargés à l'ouverture.
 * Lecture seule ; la RLS décide (accueil et gérant : tous, coach : ses séances).
 */
export async function GET(_request: Request, context: RouteContext<"/api/seances/[id]">) {
  const result = await getTeamContext();
  if (result.status !== "team") return NextResponse.json({ people: [] }, { status: 403 });
  const id = z.guid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ people: [] }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, status, waitlist_position, members(id, first_name, last_name)")
    .eq("gym_id", result.context.gym.id)
    .eq("session_id", id.data)
    .in("status", ["confirmed", "attended", "no_show", "waitlisted"])
    .order("waitlist_position", { nullsFirst: true })
    .order("booked_at");
  if (error) return NextResponse.json({ people: [] }, { status: 500 });
  return NextResponse.json({
    people: data.flatMap((row) =>
      row.members
        ? [
            {
              id: row.members.id,
              name: `${row.members.first_name} ${row.members.last_name}`,
              status: row.status,
            },
          ]
        : [],
    ),
  });
}
