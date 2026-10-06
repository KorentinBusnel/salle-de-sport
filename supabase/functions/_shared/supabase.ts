import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Client « service_role » : écritures du miroir Stripe (RLS contournée, jamais exposé). */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/** Client de l'utilisateur appelant (son jeton) : la RLS et auth.uid() s'appliquent. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
}

export type { SupabaseClient };
