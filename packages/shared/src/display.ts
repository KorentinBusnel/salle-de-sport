/**
 * Règles d'affichage partagées back office / mobile : ton des statuts et phase d'une
 * séance. Les classes de ton (`bg-success/10 text-success`…) sont identiques sur les
 * deux apps (tokens de packages/ui).
 */

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

export type BookingStatus = "confirmed" | "waitlisted" | "cancelled" | "attended" | "no_show";
export type MemberStatus = "prospect" | "active" | "suspended" | "cancelled";

export const BOOKING_STATUS_TONE: Record<BookingStatus, Tone> = {
  confirmed: "brand",
  waitlisted: "warning",
  cancelled: "neutral",
  attended: "success",
  no_show: "danger",
};

export const MEMBER_STATUS_TONE: Record<MemberStatus, Tone> = {
  prospect: "brand",
  active: "success",
  suspended: "warning",
  cancelled: "neutral",
};

/** Classes d'une pastille « soft » (fond teinté, texte de la couleur), contrastes AA testés. */
export const TONE_CLASSES: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-neutral-400" },
  brand: { pill: "bg-accent text-accent-foreground", dot: "bg-primary" },
  success: { pill: "bg-success/10 text-success", dot: "bg-success" },
  warning: { pill: "bg-warning/10 text-warning", dot: "bg-warning" },
  danger: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

export type SessionPhase = "upcoming" | "live" | "past";

/** À venir, en cours ou terminée, par rapport à `now`. */
export function sessionPhase(startsAt: Date, endsAt: Date, now: Date): SessionPhase {
  if (now < startsAt) return "upcoming";
  if (now < endsAt) return "live";
  return "past";
}

/** Taux d'occupation borné à [0, 1] (0 si la capacité est nulle). */
export function occupancy(capacity: number, booked: number): number {
  if (capacity <= 0) return 0;
  return Math.min(1, Math.max(0, booked / capacity));
}
