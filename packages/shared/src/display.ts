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

export type MessageStatus = "queued" | "logged" | "sent" | "failed";

/** File d'envoi : « journalisé » = pas d'envoi réel (aucun service d'emails branché). */
export const MESSAGE_STATUS_TONE: Record<MessageStatus, Tone> = {
  queued: "warning",
  logged: "neutral",
  sent: "success",
  failed: "danger",
};

/** Statut d'un paiement (back office et app). */
export const PAYMENT_STATUS_TONE: Record<"pending" | "succeeded" | "failed" | "refunded", Tone> = {
  succeeded: "success",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
};

/** Ton d'un statut d'abonnement (fiche adhérent, synthèse). */
export const SUBSCRIPTION_STATUS_TONE: Record<
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused",
  Tone
> = {
  active: "success",
  trialing: "brand",
  past_due: "danger",
  unpaid: "danger",
  canceled: "neutral",
  incomplete: "warning",
  incomplete_expired: "neutral",
  paused: "neutral",
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

export type Trend = { direction: "up" | "down" | "flat"; ratio: number } | null;

/**
 * Variation d'un indicateur par rapport à la période précédente (`ratio` : 0,12 = +12 %).
 * Pas de comparaison sans période précédente ou depuis zéro. Sous 0,5 % : stable.
 */
export function trendChange(current: number, previous: number | null | undefined): Trend {
  if (previous === null || previous === undefined || previous === 0) return null;
  const ratio = (current - previous) / Math.abs(previous);
  if (Math.abs(ratio) < 0.005) return { direction: "flat", ratio: 0 };
  return { direction: ratio > 0 ? "up" : "down", ratio };
}

/**
 * Séance « peu remplie » (étiquette seule, sans action proposée) : à venir ou en cours, avec des
 * places, remplie sous le seuil réglé par la salle (low_fill_percent, 50 % par défaut).
 */
export function isLowFill(session: {
  booked: number;
  capacity: number;
  percent: number;
  phase: SessionPhase;
  status?: string | undefined;
}): boolean {
  if (session.capacity <= 0 || session.percent <= 0) return false;
  if (session.phase === "past" || (session.status && session.status !== "scheduled")) return false;
  return session.booked * 100 < session.capacity * session.percent;
}
