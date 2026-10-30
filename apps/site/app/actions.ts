"use server";

import { bookingErrorCode, demoEmailSchema } from "@salle/shared";
import { anonClient } from "@/lib/supabase.server";

/** État du champ « Demander une démo » ; l'email saisi revient pour le réafficher. */
export type DemoEmailState =
  | { status: "idle" }
  | { status: "invalid"; email: string }
  | { status: "failed"; error: "tooMany" | "unavailable"; email: string }
  | { status: "sent"; email: string };

// Un humain met plus de 3 secondes entre l'ouverture de la page et l'envoi.
const MIN_SECONDS = 3;

/**
 * « Demander une démo » du hero : l'email seul, filtre anti robots (champ piège, envoi trop
 * rapide), puis `request_demo` (type `demo`) avec la clé anon. La base valide à nouveau, ignore un
 * doublon du jour et plafonne le nombre de demandes par heure.
 */
export async function requestDemo(
  _previous: DemoEmailState,
  formData: FormData,
): Promise<DemoEmailState> {
  const email = String(formData.get("email") ?? "");

  // Un robot reçoit la même réponse qu'un envoi réussi, sans rien enregistrer.
  const elapsed = Number(formData.get("elapsed") || Number.NaN);
  if (formData.get("website") || elapsed < MIN_SECONDS) {
    return { status: "sent", email: email.trim() };
  }

  const parsed = demoEmailSchema.safeParse({ email });
  if (!parsed.success) return { status: "invalid", email };

  const supabase = anonClient();
  if (!supabase) {
    console.error("Demande de démo : NEXT_PUBLIC_SUPABASE_URL ou _ANON_KEY manquante.");
    return { status: "failed", error: "unavailable", email };
  }
  const { error } = await supabase.rpc("request_demo", {
    p_kind: "demo",
    p_email: parsed.data.email,
  });
  if (error) {
    if (bookingErrorCode(error) === "too_many_requests") {
      return { status: "failed", error: "tooMany", email };
    }
    console.error("Demande de démo : request_demo a échoué.", error.message);
    return { status: "failed", error: "unavailable", email };
  }
  return { status: "sent", email: parsed.data.email };
}
