import { z } from "zod";

/**
 * Changements d'une séance ou d'un cours récurrent (update_session / update_template). Miroir
 * des contrôles SQL : durée de 15 à 240 min par pas de 5, places de 1 à 200.
 */
export const DURATION = { min: 15, max: 240, step: 5 } as const;
export const CAPACITY = { min: 1, max: 200 } as const;

export const durationSchema = z
  .number()
  .int()
  .min(DURATION.min)
  .max(DURATION.max)
  .refine((v) => v % DURATION.step === 0);
export const capacitySchema = z.number().int().min(CAPACITY.min).max(CAPACITY.max);

export const classChangesSchema = z
  .object({
    capacity: capacitySchema,
    duration_minutes: durationSchema,
    coach_ids: z.array(z.guid()).max(10),
    room_id: z.guid().nullable(),
    discipline_id: z.guid(),
  })
  .partial()
  .strict();

export const templateChangesSchema = classChangesSchema
  .extend({
    weekday: z.number().int().min(1).max(7),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    starts_on: z.iso.date(),
    ends_on: z.iso.date().nullable(),
    is_active: z.boolean(),
  })
  .partial()
  .strict();

export type ClassChanges = z.infer<typeof classChangesSchema>;
export type TemplateChanges = z.infer<typeof templateChangesSchema>;

/** Portée d'une modification de séance issue d'un cours récurrent. */
export const CHANGE_SCOPES = ["one", "following"] as const;
export type ChangeScope = (typeof CHANGE_SCOPES)[number];

/** « Sarah B. + 1 » : coach principal et nombre d'autres coachs. */
export function coachesLabel(names: readonly string[]): string {
  const [first, ...rest] = names;
  if (!first) return "";
  return rest.length ? `${first} + ${rest.length}` : first;
}
