import { zonedDateKey } from "@salle/shared";

/** Ce que le rôle peut faire lui-même depuis l'accueil (voir `getTodayFrame`). */
export type ActionRole = { manager: boolean; frontDesk: boolean };

export type ActionCounts = {
  /** Présences à pointer sur les séances commencées (ses séances pour un coach). */
  toCheck: number;
  /** Trous de permanence à l'accueil : seul le gérant les assigne. */
  deskGaps: number;
  /** Fiches et messages du CRM à traiter (gérant). */
  crmTodo: number;
  /** Impayés à relancer ou encaisser (accueil et gérant), sauf ceux déjà relancés aujourd'hui. */
  unpaid: number;
};

/**
 * Nombre d'actions annoncé dans le titre de l'accueil : seulement celles que le rôle peut mener,
 * pour qu'un coach ou l'accueil ne lise pas « 1 action » qu'il ne peut pas traiter.
 */
export function countActions(role: ActionRole, counts: ActionCounts): number {
  return (
    counts.toCheck +
    (role.manager ? counts.deskGaps + counts.crmTodo : 0) +
    (role.frontDesk ? counts.unpaid : 0)
  );
}

/**
 * Impayé déjà relancé aujourd'hui (`last_reminded_at` de `unpaid_members`) : une relance par
 * jour, la suivante attend demain. Le jour de la salle fait foi ; la base compte aussi en jour
 * UTC (`send_payment_reminder`), d'où le second test, pour ne jamais proposer une relance
 * qu'elle refuserait (`already_reminded`) autour de minuit.
 */
export function remindedToday(lastRemindedAt: string | null, now: Date, timeZone: string): boolean {
  if (!lastRemindedAt) return false;
  const at = new Date(lastRemindedAt);
  return (
    zonedDateKey(at, timeZone) === zonedDateKey(now, timeZone) ||
    zonedDateKey(at, "UTC") === zonedDateKey(now, "UTC")
  );
}
