"use server";

import {
  bookingErrorCode,
  DEMO_REQUEST_FIELDS,
  demoRequestSchema,
  type DemoRequestField,
  type SiteRequestKind,
} from "@salle/shared";
import { anonClient } from "@/lib/supabase.server";

/** Saisie telle que reçue, pour la réafficher après une erreur. */
export type DemoFormValues = Record<DemoRequestField, string>;

export type DemoFormState =
  | { status: "idle" }
  | { status: "invalid"; fields: DemoRequestField[]; values: DemoFormValues }
  | { status: "failed"; error: "tooMany" | "unavailable"; values: DemoFormValues }
  | { status: "sent"; kind: SiteRequestKind; email: string };

// Un humain met plus de 3 secondes entre l'ouverture de la page et l'envoi.
const MIN_SECONDS = 3;

/**
 * Formulaire du site (« Créer ma salle » ou « Poser une question ») : validation Zod, filtre anti
 * robots (champ piège, envoi trop rapide), puis `request_demo` avec la clé anon. La base valide à
 * nouveau, ignore un doublon du jour et plafonne le nombre de demandes par heure.
 */
export async function requestDemo(
  _previous: DemoFormState,
  formData: FormData,
): Promise<DemoFormState> {
  const values = Object.fromEntries(
    DEMO_REQUEST_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as DemoFormValues;
  const kind: SiteRequestKind = formData.get("kind") === "contact" ? "contact" : "trial";

  // Un robot reçoit la même réponse qu'un envoi réussi, sans rien enregistrer.
  const elapsed = Number(formData.get("elapsed") || Number.NaN);
  if (formData.get("website") || elapsed < MIN_SECONDS) {
    return { status: "sent", kind, email: values.email.trim() };
  }

  const parsed = demoRequestSchema.safeParse({ ...values, kind });
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => issue.path[0] as DemoRequestField));
    return {
      status: "invalid",
      fields: DEMO_REQUEST_FIELDS.filter((field) => fields.has(field)),
      values,
    };
  }

  const supabase = anonClient();
  if (!supabase) {
    console.error("Formulaire du site : NEXT_PUBLIC_SUPABASE_URL ou _ANON_KEY manquante.");
    return { status: "failed", error: "unavailable", values };
  }
  const request = parsed.data;
  // Champs facultatifs vides : chaîne vide, ramenée à null par la fonction SQL.
  const { error } = await supabase.rpc("request_demo", {
    p_kind: request.kind,
    p_full_name: request.fullName,
    p_gym_name: request.gymName,
    p_email: request.email,
    p_phone: request.phone ?? "",
    p_city: request.city ?? "",
    ...(request.membersBand ? { p_members_band: request.membersBand } : {}),
    p_current_tool: request.currentTool ?? "",
    p_message: request.message ?? "",
  });
  if (error) {
    if (bookingErrorCode(error) === "too_many_requests") {
      return { status: "failed", error: "tooMany", values };
    }
    console.error("Formulaire du site : request_demo a échoué.", error.message);
    return { status: "failed", error: "unavailable", values };
  }
  return { status: "sent", kind, email: request.email };
}
