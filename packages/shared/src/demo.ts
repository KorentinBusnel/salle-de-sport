import { z } from "zod";
import type { Tone } from "./display.ts";

/** Taille de la salle déclarée dans une demande (enum SQL `demo_members_band`). */
export const MEMBERS_BANDS = ["under_100", "100_to_300", "300_to_600", "over_600"] as const;
export type MembersBand = (typeof MEMBERS_BANDS)[number];

/**
 * Types de demande du site vitrine (enum SQL `demo_request_kind`) : « Commencez gratuitement »
 * (`trial`) et « Nous contacter » (`contact`). `demo` ne désigne que les demandes du premier
 * formulaire, refusées désormais par `request_demo`.
 */
export const DEMO_REQUEST_KINDS = ["trial", "contact"] as const;
export type DemoRequestKind = (typeof DEMO_REQUEST_KINDS)[number] | "demo";

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

/** Champ facultatif : vide → null. */
const optionalText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value === "" || value.length >= min)
    .transform((value) => value || null);

const common = {
  fullName: z.string().trim().min(2).max(80),
  gymName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
  phone: optionalText(30).refine((value) => value === null || /^\+?[\d\s.()-]{6,}$/.test(value)),
  currentTool: optionalText(80),
};

/**
 * Formulaire du site vitrine ; mêmes règles que `request_demo` en SQL, qui reste la barrière.
 * Essai : ville et taille exigées. Question : message exigé, ville et taille facultatives.
 */
export const demoRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("trial"),
    ...common,
    city: z.string().trim().min(2).max(80),
    membersBand: z.enum(MEMBERS_BANDS),
    message: optionalText(1000),
  }),
  z.object({
    kind: z.literal("contact"),
    ...common,
    city: optionalText(80, 2),
    membersBand: z
      .union([z.enum(MEMBERS_BANDS), z.literal("")])
      .transform((value) => value || null),
    message: z.string().trim().min(2).max(1000),
  }),
]);

export type DemoRequestInput = z.input<typeof demoRequestSchema>;
export type DemoRequest = z.output<typeof demoRequestSchema>;

/** Champs du formulaire, dans l'ordre d'affichage (le type se choisit à part). */
export const DEMO_REQUEST_FIELDS = [
  "fullName",
  "gymName",
  "email",
  "phone",
  "city",
  "membersBand",
  "currentTool",
  "message",
] as const;
export type DemoRequestField = (typeof DEMO_REQUEST_FIELDS)[number];
