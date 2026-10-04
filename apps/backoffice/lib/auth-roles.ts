import { canSeeFinancials, type GymRole } from "@salle/shared";

/** Gérant ou admin : planning, cours récurrents, paramètres, finances. */
export function isManagerRole(role: GymRole): boolean {
  return canSeeFinancials(role);
}

/** Accueil et au-dessus : réservations et fiches adhérents. */
export function isFrontDeskRole(role: GymRole): boolean {
  return role === "staff" || isManagerRole(role);
}
