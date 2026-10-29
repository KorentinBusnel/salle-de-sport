import { z } from "zod";
import type { Tone } from "./display.ts";

/** Taille de la salle déclarée dans une demande de démo (enum SQL `demo_members_band`). */
export const MEMBERS_BANDS = ["under_100", "100_to_300", "300_to_600", "over_600"] as const;
export type MembersBand = (typeof MEMBERS_BANDS)[number];

/** Suivi d'une demande de démo par les admins (enum SQL `demo_request_status`). */
export const DEMO_REQUEST_STATUSES = ["new", "contacted", "demo_done", "dropped"] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const DEMO_REQUEST_STATUS_TONE: Record<DemoRequestStatus, Tone> = {
  new: "warning",
  contacted: "brand",
  demo_done: "success",
  dropped: "neutral",
};

/** Champ facultatif : vide → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

/**
 * Formulaire « Demander une démo » du site vitrine ; mêmes bornes que `request_demo` en SQL,
 * qui reste la barrière.
 */
export const demoRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  gymName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
  phone: optionalText(30).refine((value) => value === null || /^\+?[\d\s.()-]{6,}$/.test(value)),
  city: z.string().trim().min(2).max(80),
  membersBand: z.enum(MEMBERS_BANDS),
  currentTool: optionalText(80),
  message: optionalText(1000),
});

export type DemoRequestInput = z.input<typeof demoRequestSchema>;
export type DemoRequest = z.output<typeof demoRequestSchema>;
export type DemoRequestField = keyof DemoRequestInput;

/** Champs du formulaire, dans l'ordre d'affichage. */
export const DEMO_REQUEST_FIELDS = Object.keys(demoRequestSchema.shape) as DemoRequestField[];
