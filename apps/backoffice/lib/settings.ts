import "server-only";
import { type GymSettings, parseGymSettings } from "@salle/shared";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Réglages et stratégies de la salle, mémorisés pour la durée de la requête. */
export const getGymSettings = cache(async (gymId: string): Promise<GymSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("gyms").select("settings").eq("id", gymId).single();
  return parseGymSettings(data?.settings);
});
