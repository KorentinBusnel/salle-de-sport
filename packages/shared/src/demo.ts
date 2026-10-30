import { z } from "zod";
import type { Tone } from "./display.ts";

/** Taille de la salle déclarée dans une demande (enum SQL `demo_members_band`). */
export const MEMBERS_BANDS = ["under_100", "100_to_300", "300_to_600", "over_600"] as const;
export type MembersBand = (typeof MEMBERS_BANDS)[number];

/**
 * Types de demande (enum SQL `demo_request_kind`) : `demo`, l'email saisi dans le hero du site
 * (seul type que le site envoie) ; `trial` (essai) et `contact` (question), ceux de l'ancien
 * formulaire, que `request_demo` garde valides.
 */
export const DEMO_REQUEST_KINDS = ["demo", "trial", "contact"] as const;
export type DemoRequestKind = (typeof DEMO_REQUEST_KINDS)[number];

/** Suivi d'une demande par les admins (enum SQL `demo_request_status`). */
export const DEMO_REQUEST_STATUSES = [
  "new",
  "contacted",
  "demo_done",
  "onboarded",
  "dropped",
] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const DEMO_REQUEST_STATUS_TONE: Record<DemoRequestStatus, Tone> = {
  new: "warning",
  contacted: "brand",
  demo_done: "success",
  onboarded: "success",
  dropped: "neutral",
};

/**
 * Champ « Demander une démo » du site : l'email seul, mêmes règles que `request_demo` en SQL, qui
 * reste la barrière.
 */
export const demoEmailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
});
export type DemoEmail = z.output<typeof demoEmailSchema>;
