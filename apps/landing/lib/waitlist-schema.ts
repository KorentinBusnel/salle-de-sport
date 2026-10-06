import { z } from "zod";

/** Champs UTM : facultatifs, tronqués à 100 caractères, vides ignorés. */
const utm = z
  .string()
  .trim()
  .transform((value) => value.slice(0, 100) || undefined)
  .optional();

/**
 * Formulaire de la liste d'attente (les deux emplacements). L'email est normalisé ici et en SQL
 * (join_waitlist) : minuscules, sans espaces.
 */
export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: "email" })),
  consent: z.literal("on", { error: "consent" }),
  placement: z.enum(["hero", "final"]),
  /** Honeypot : un humain ne voit pas ce champ et le laisse vide. */
  website: z.string().optional(),
  utm_source: utm,
  utm_medium: utm,
  utm_campaign: utm,
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type Placement = WaitlistInput["placement"];

export type WaitlistError = "email" | "consent" | "rate_limited" | "generic";

/** Réponse de la Server Action, partagée par les deux formulaires (emplacement d'origine). */
export type WaitlistState =
  | { status: "idle" }
  | { status: "joined" | "already_joined"; placement: Placement }
  | { status: "error"; error: WaitlistError; placement: Placement };

export function parseWaitlistForm(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return waitlistSchema.safeParse({
    email: field("email") ?? "",
    consent: field("consent"),
    placement: field("placement"),
    website: field("website"),
    utm_source: field("utm_source"),
    utm_medium: field("utm_medium"),
    utm_campaign: field("utm_campaign"),
  });
}

/** Première erreur à afficher : l'email avant la case de consentement. */
export function firstError(error: z.ZodError): "email" | "consent" | "generic" {
  const paths = error.issues.map((issue) => String(issue.path[0]));
  if (paths.includes("email")) return "email";
  if (paths.includes("consent")) return "consent";
  return "generic";
}
