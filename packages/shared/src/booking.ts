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
  /** L'accueil inscrit un retardataire jusqu'à N minutes après le début (0 : jamais). */
  late_booking_minutes: z.number().int().min(0).max(60).default(0),
  /** Le pointage ouvre N minutes avant le début (null : à tout moment). */
  attendance_opens_minutes_before: z.number().int().min(0).max(1440).nullable().default(null),
  /** « Remettre à confirmé » un adhérent pointé présent ou absent. */
  allow_attendance_reset: z.boolean().default(false),
  /** Le gérant peut retirer des crédits (motif obligatoire). */
  manager_can_remove_credits: z.boolean().default(false),
  /** L'accueil peut suspendre et réactiver une fiche (sinon : gérant seulement). */
  staff_can_suspend_members: z.boolean().default(false),
  /** L'accueil peut créer une fiche (sinon : gérant seulement). */
  staff_can_create_members: z.boolean().default(false),
  /** L'accueil peut enregistrer une vente sur place (sinon : gérant seulement). */
  staff_can_sell: z.boolean().default(false),
});

export type GymSettings = z.infer<typeof gymSettingsSchema>;

/** Valeurs par défaut : celles que les fonctions SQL appliquent en l'absence de réglage. */
export const DEFAULT_GYM_SETTINGS: GymSettings = gymSettingsSchema.parse({});

/** Lit gyms.settings en complétant les valeurs absentes ou invalides par les défauts. */
export function parseGymSettings(raw: unknown): GymSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_GYM_SETTINGS };
  for (const key of Object.keys(gymSettingsSchema.shape) as (keyof GymSettings)[]) {
    const parsed = gymSettingsSchema.shape[key].safeParse(source[key]);
    if (parsed.success) Object.assign(settings, { [key]: parsed.data });
  }
  return settings;
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
  "session_full",
  "attendance_not_open",
  "strategy_disabled",
  "invalid_amount",
  "reason_required",
  "invalid_settings",
  "insufficient_credits",
  "invalid_transition",
  "invalid_input",
  "duplicate_member",
  "session_ended",
  "coach_not_found",
  "same_coach",
  "campaign_not_found",
  "campaign_not_editable",
  "segment_not_found",
  "account_not_found",
  "cannot_remove_self",
  "capacity_below_booked",
  "room_capacity_exceeded",
  "not_team_member",
  "invalid_duration",
  "plan_discipline",
  "plan_not_found",
  "plan_inactive",
  "already_subscribed",
  "promo_invalid",
  "promo_exhausted",
  "subscription_not_found",
  "not_renewable",
  // Paiements en ligne (Edge Function « billing »)
  "commitment_running",
  "stripe_not_configured",
  "stripe_error",
  "no_stripe_customer",
  "not_refundable",
  "payment_not_found",
  // Impayés et relances
  "not_unpaid",
  "not_settleable",
  "already_reminded",
  "payment_overdue",
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
