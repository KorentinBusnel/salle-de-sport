import "server-only";
import { createHmac } from "node:crypto";
import type { Database } from "@salle/supabase";
import { createClient } from "@supabase/supabase-js";
import type { WaitlistInput } from "@/lib/waitlist-schema";

/**
 * Clé de limitation de débit : empreinte HMAC-SHA256 de l'IP du visiteur, avec un secret serveur.
 * L'IP n'est ni transmise à la base ni conservée ; la clé y vit une heure au plus.
 */
export function clientKey(headers: Headers, secret: string): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHmac("sha256", secret).update(`waitlist:${ip}`).digest("hex");
}

export type JoinResult =
  | { status: "joined" | "already_joined"; id: string }
  | { status: "error"; error: "rate_limited" | "invalid" | "unavailable" };

/** Inscription par join_waitlist (clé service_role : seul appel autorisé, aucune policy). */
export async function addToWaitlist(
  supabase: { url: string; serviceRoleKey: string },
  input: WaitlistInput,
  consentText: string,
  key: string | null,
): Promise<JoinResult> {
  const client = createClient<Database>(supabase.url, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("join_waitlist", {
    p_email: input.email,
    p_consent: true,
    p_consent_text: consentText,
    p_placement: input.placement,
    ...(input.utm_source ? { p_source: input.utm_source } : {}),
    ...(input.utm_medium ? { p_utm_medium: input.utm_medium } : {}),
    ...(input.utm_campaign ? { p_utm_campaign: input.utm_campaign } : {}),
    ...(key ? { p_client_key: key } : {}),
  });
  if (error) {
    if (error.message === "rate_limited") return { status: "error", error: "rate_limited" };
    if (error.message === "invalid_input") return { status: "error", error: "invalid" };
    console.error("Liste d'attente : appel join_waitlist en échec", error);
    return { status: "error", error: "unavailable" };
  }
  const result = data as { status?: string; id?: string } | null;
  if ((result?.status === "joined" || result?.status === "already_joined") && result.id) {
    return { status: result.status, id: result.id };
  }
  console.error("Liste d'attente : réponse inattendue de join_waitlist", data);
  return { status: "error", error: "unavailable" };
}
