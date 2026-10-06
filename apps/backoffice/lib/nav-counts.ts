import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type NavCounts = {
  prospects: number | null;
  unanswered: number | null;
  trials_to_call: number | null;
  unpaid: number | null;
};

/** Comptages des pastilles (une RPC légère, partagée par toutes les pastilles du rendu). */
export const getNavCounts = cache(async (gymId: string): Promise<NavCounts | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("nav_counts", { p_gym_id: gymId });
  return data?.[0] ?? null;
});

/** CRM à compléter, partagé entre l'accueil et la liste des adhérents d'un même rendu. */
export const getCrmTodo = cache(async (gymId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("crm_todo", { p_gym_id: gymId });
  return data ?? [];
});
