import "server-only";
import { anonClient } from "@/lib/supabase.server";

/** Nombre de salles de la plateforme (table publique `gyms`), ou null si la base ne répond pas. */
export async function getGymCount(): Promise<number | null> {
  const supabase = anonClient();
  if (!supabase) return null;
  try {
    const { count, error } = await supabase
      .from("gyms")
      .select("id", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(3000));
    return error ? null : count;
  } catch {
    return null;
  }
}
