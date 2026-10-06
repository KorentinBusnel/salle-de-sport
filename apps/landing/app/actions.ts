"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { form } from "@/content/landing";
import { sendConfirmation } from "@/lib/email";
import { serverEnv } from "@/lib/env.server";
import { siteUrl } from "@/lib/site";
import { addToWaitlist, clientKey } from "@/lib/waitlist";
import {
  firstError,
  parseWaitlistForm,
  type Placement,
  type WaitlistState,
} from "@/lib/waitlist-schema";

/**
 * Inscription à la liste d'attente (LANDING_BRIEF.md §6) : validation Zod, honeypot, limite de
 * débit (en base), puis email de confirmation envoyé après la réponse.
 */
export async function joinWaitlist(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const placement: Placement = formData.get("placement") === "final" ? "final" : "hero";
  const parsed = parseWaitlistForm(formData);
  if (!parsed.success) return { status: "error", error: firstError(parsed.error), placement };
  const input = parsed.data;

  // Honeypot rempli : un robot. Faux succès, rien n'est enregistré.
  if (input.website) return { status: "joined", placement };

  const env = serverEnv();
  if (!env.supabase) {
    console.error(
      "Liste d'attente non configurée : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent.",
    );
    return { status: "error", error: "generic", placement };
  }

  // Secret du HMAC de l'IP : la clé service_role, déjà présente et jamais exposée.
  const key = clientKey(await headers(), env.supabase.serviceRoleKey);
  const result = await addToWaitlist(env.supabase, input, form.consent, key);
  if (result.status === "error") {
    const error =
      result.error === "rate_limited"
        ? "rate_limited"
        : result.error === "invalid"
          ? "email"
          : "generic";
    return { status: "error", error, placement };
  }

  if (result.status === "joined") {
    const resend = env.resend;
    if (resend) {
      const home = siteUrl().href;
      after(() => sendConfirmation(resend, input.email, result.id, home));
    } else {
      console.warn("Resend non configuré (RESEND_API_KEY, RESEND_FROM) : aucun email envoyé.");
    }
  }
  return { status: result.status, placement };
}
