import "server-only";
import type { TypedSupabaseClient } from "@salle/supabase";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env.server";

/**
 * Client Supabase anonyme côté serveur (clé anon, filtrée par la RLS), ou null si les variables
 * manquent : la page se construit sans elles.
 */
export function anonClient(): TypedSupabaseClient | null {
  const env = supabaseEnv();
  if (!env) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
