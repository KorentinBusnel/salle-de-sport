import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database, TypedSupabaseClient } from "@salle/supabase";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur, authentifié par les cookies de session.
 * Toutes les lectures passent par la RLS avec l'identité de l'utilisateur.
 */
export async function createClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component (cookies en lecture seule) :
            // le proxy se charge de rafraîchir la session.
          }
        },
      },
    },
  );
}
