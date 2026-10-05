import "server-only";
import type { TeamContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Équipe de la salle (coach, accueil, gérant) pour les permanences : gérant uniquement. */
export async function getTeamOptions(context: TeamContext) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_members", { p_gym_id: context.gym.id });
  return (data ?? [])
    .filter((m) => m.roles.some((role) => role !== "member"))
    .map((m) => ({
      id: m.profile_id,
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "—",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
