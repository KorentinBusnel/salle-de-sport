import { z } from "zod";

/**
 * Paramètres de réservation d'une salle (gyms.settings). Valeurs par défaut identiques à
 * celles de la migration 20261005090000_booking_core.sql.
 */
export const gymSettingsSchema = z.object({
  /** Réservations à venir (confirmées + liste d'attente) au plus par adhérent. */
  max_upcoming_bookings: z.number().int().min(1).max(50).default(5),
  /** Délai d'annulation recommandé, affiché seulement : l'annulation reste libre. */
  cancellation_recommended_hours: z.number().min(0).max(72).default(2),
});

export type GymSettings = z.infer<typeof gymSettingsSchema>;

/** Lit gyms.settings en complétant les valeurs absentes ou invalides par les défauts. */
export function parseGymSettings(raw: unknown): GymSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    max_upcoming_bookings: gymSettingsSchema.shape.max_upcoming_bookings
      .catch(5)
      .parse(source.max_upcoming_bookings),
    cancellation_recommended_hours: gymSettingsSchema.shape.cancellation_recommended_hours
      .catch(2)
      .parse(source.cancellation_recommended_hours),
  };
}

/** Codes levés par les fonctions SQL de réservation (raise exception '<code>'). */
export const BOOKING_ERROR_CODES = [
  "session_not_found",
  "session_cancelled",
  "session_started",
  "not_a_member",
  "member_not_found",
  "forbidden",
  "member_not_active",
  "already_booked",
  "max_upcoming_reached",
  "no_credit",
  "booking_not_found",
  "not_cancellable",
  "invalid_status",
  "not_attendable",
  "invalid_period",
  "not_authenticated",
  "terms_not_accepted",
  "waiver_not_accepted",
] as const;

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number];

/** Extrait le code métier d'une erreur Supabase/PostgREST, ou null si l'erreur est autre. */
export function bookingErrorCode(
  error: { message?: string } | null | undefined,
): BookingErrorCode | null {
  const message = error?.message?.trim();
  return (BOOKING_ERROR_CODES as readonly string[]).includes(message ?? "")
    ? (message as BookingErrorCode)
    : null;
}

/** Places encore libres (jamais négatif). */
export function spotsLeft(capacity: number, bookedCount: number): number {
  return Math.max(0, capacity - bookedCount);
}

/** Une réservation s'annule librement tant que le cours n'a pas commencé. */
export function canCancel(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() > now.getTime();
}

/**
 * Annulation « tardive » : moins de N heures avant le cours. Sans conséquence (aucune
 * pénalité), elle sert seulement à afficher la recommandation de la salle.
 */
export function isLateCancellation(startsAt: Date, now: Date, recommendedHours: number): boolean {
  const msBefore = startsAt.getTime() - now.getTime();
  return msBefore > 0 && msBefore < recommendedHours * 3_600_000;
}
