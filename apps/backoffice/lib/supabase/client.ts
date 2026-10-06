import { createBrowserClient } from "@supabase/ssr";
import type { Database, TypedSupabaseClient } from "@salle/supabase";
import { publicEnv } from "@/lib/env";

let client: TypedSupabaseClient | undefined;

/**
 * Client Supabase du navigateur (session lue dans les cookies posés par le serveur), pour le
 * Realtime uniquement : les lectures et écritures passent par le serveur. Clé anon, RLS.
 */
export function createClient(): TypedSupabaseClient {
  client ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
