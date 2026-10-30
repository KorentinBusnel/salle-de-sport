/** Ce que le rôle peut faire lui-même depuis l'accueil (voir `getTodayFrame`). */
export type ActionRole = { manager: boolean; frontDesk: boolean };

export type ActionCounts = {
  /** Présences à pointer sur les séances commencées (ses séances pour un coach). */
  toCheck: number;
  /** Trous de permanence à l'accueil : seul le gérant les assigne. */
  deskGaps: number;
  /** Fiches et messages du CRM à traiter (gérant). */
  crmTodo: number;
  /** Impayés à relancer ou encaisser (accueil et gérant). */
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
