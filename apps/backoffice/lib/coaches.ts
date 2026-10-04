import "server-only";
import { zonedDateKey } from "@salle/shared";
import { cache } from "react";
import type { TeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

/** Fiche coach de l'utilisateur connecté dans sa salle (null s'il n'est pas coach). */
export const getOwnCoachId = cache(async (userId: string, gymId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coaches")
    .select("id")
    .eq("gym_id", gymId)
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.id ?? null;
});

/** Mois courant « AAAA-MM » dans le fuseau de la salle. */
export function currentMonthKey(context: TeamContext): string {
  return zonedDateKey(currentTime(), context.gym.timezone).slice(0, 7);
}
